/**
 * Two-way sync between Google Calendar and the Jobs table.
 *
 * Division of ownership, decided 2026-08-01:
 *   - Scheduling (title, date, time, location) can be edited on EITHER side.
 *     Whoever touched it last wins, decided by Google's `updated` timestamp
 *     against the `gcalUpdated` we stored on the last sync.
 *   - Money and assignment (client, worker, laborCost, chargeAmount, status)
 *     live in CHM only. A pull never overwrites them. They are mirrored into
 *     the Google event description so they are readable on the phone.
 *
 * Recurring events are pulled with singleEvents=true, so a Tuesday route comes
 * back as one row per visit. Each occurrence gets its own Job and can be marked
 * done and costed independently. The window is what bounds the row count.
 */
import { prisma } from "@/lib/db";
import { gcal, calendarId, googleConnected, setState, KEY_LAST_SYNC, KEY_SYNC_NOTE, type GEvent } from "@/lib/google";
import type { Job } from "@prisma/client";

const TZ = "America/Chicago";
/** How far back and forward we mirror. Forward bound is what "60 days out" means. */
export const WINDOW_BACK_DAYS = 30;
export const WINDOW_FORWARD_DAYS = 60;

export type SyncResult = {
  ok: boolean;
  created: number;
  updated: number;
  cancelled: number;
  skipped: number;
  linkedClients: number;
  message: string;
};

// ---------------------------------------------------------------- date helpers

function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** All-day Google dates are floating. Anchor at local noon so no timezone can shift the day. */
function parseAllDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d, 12);
}

function eventStart(e: GEvent): { date: Date; allDay: boolean } | null {
  if (e.start?.date) return { date: parseAllDay(e.start.date), allDay: true };
  if (e.start?.dateTime) return { date: new Date(e.start.dateTime), allDay: false };
  return null;
}

function eventEnd(e: GEvent, allDay: boolean): Date | null {
  if (allDay && e.end?.date) {
    // Google's all-day end is exclusive. Step back a day so it reads naturally.
    const d = parseAllDay(e.end.date);
    d.setDate(d.getDate() - 1);
    return d;
  }
  if (e.end?.dateTime) return new Date(e.end.dateTime);
  return null;
}

// ------------------------------------------------------- CHM block in description

const BLOCK_START = "--- CHM ---";
const BLOCK_END = "--- end CHM ---";

/** Strip our own block so a round trip never duplicates it or eats his notes. */
export function stripBlock(description: string | null | undefined): string {
  if (!description) return "";
  const i = description.indexOf(BLOCK_START);
  if (i === -1) return description.trim();
  const j = description.indexOf(BLOCK_END, i);
  const tail = j === -1 ? "" : description.slice(j + BLOCK_END.length);
  return (description.slice(0, i) + tail).trim();
}

type JobForPush = Job & {
  client?: { name: string } | null;
  worker?: { name: string } | null;
  tasks?: { title: string; done: boolean }[];
};

function buildDescription(job: JobForPush): string {
  const lines: string[] = [];
  if (job.client?.name) lines.push(`Client: ${job.client.name}`);
  lines.push(`Who: ${job.worker?.name ?? "Ryder"}`);
  if (job.chargeAmount != null) lines.push(`Charge: $${Number(job.chargeAmount).toFixed(2)}`);
  if (Number(job.laborCost) > 0) lines.push(`Labor: $${Number(job.laborCost).toFixed(2)}`);
  if (job.status !== "SCHEDULED") lines.push(`Status: ${job.status}`);
  if (job.tasks?.length) {
    lines.push("Checklist:");
    for (const t of job.tasks) lines.push(`  ${t.done ? "[x]" : "[ ]"} ${t.title}`);
  }
  const own = stripBlock(job.notes);
  const block = [BLOCK_START, ...lines, BLOCK_END].join("\n");
  return own ? `${own}\n\n${block}` : block;
}

function toGoogleEvent(job: JobForPush): Record<string, unknown> {
  const start = job.date;
  const end = job.endDate ?? (job.durationMin ? new Date(start.getTime() + job.durationMin * 60_000) : null);

  const body: Record<string, unknown> = {
    summary: job.title,
    description: buildDescription(job),
    location: job.location ?? undefined,
    extendedProperties: {
      private: {
        chmJobId: job.id,
        ...(job.clientId ? { chmClientId: job.clientId } : {}),
      },
    },
  };

  if (job.allDay) {
    const endExclusive = new Date((end ?? start).getTime());
    endExclusive.setDate(endExclusive.getDate() + 1);
    body.start = { date: ymd(start) };
    body.end = { date: ymd(endExclusive) };
  } else {
    body.start = { dateTime: start.toISOString(), timeZone: TZ };
    body.end = { dateTime: (end ?? new Date(start.getTime() + 60 * 60_000)).toISOString(), timeZone: TZ };
  }
  return body;
}

// ----------------------------------------------------------------- client match

type ClientLite = { id: string; name: string; email: string | null };

/**
 * Best-effort. Never guesses over an existing link, and never invents a client.
 * Order: our own tag on the event, then attendee email, then name in the title.
 */
function matchClient(e: GEvent, clients: ClientLite[], byId: Set<string>): string | null {
  const tagged = e.extendedProperties?.private?.chmClientId;
  if (tagged && byId.has(tagged)) return tagged;

  const emails = new Set((e.attendees ?? []).map((a) => a.email?.toLowerCase()).filter(Boolean) as string[]);
  if (emails.size) {
    const hit = clients.find((c) => c.email && emails.has(c.email.toLowerCase()));
    if (hit) return hit.id;
  }

  const hay = `${e.summary ?? ""} ${e.location ?? ""}`.toLowerCase();
  if (!hay.trim()) return null;

  // Longest full-name match wins, so "Becky Cowart Portera" beats a stray "Becky".
  const full = clients
    .filter((c) => hay.includes(c.name.toLowerCase()))
    .sort((a, b) => b.name.length - a.name.length)[0];
  if (full) return full.id;

  // Fall back to a distinctive surname: 5+ chars and owned by exactly one client.
  let found: string | null = null;
  for (const c of clients) {
    const last = c.name.trim().split(/\s+/).pop() ?? "";
    if (last.length < 5) continue;
    if (!hay.includes(last.toLowerCase())) continue;
    const owners = clients.filter((o) => (o.name.trim().split(/\s+/).pop() ?? "").toLowerCase() === last.toLowerCase());
    if (owners.length !== 1) continue;
    if (found) return null; // two different surnames matched, too ambiguous
    found = c.id;
  }
  return found;
}

// ---------------------------------------------------------------------- pull

export async function syncCalendar(): Promise<SyncResult> {
  const empty = { created: 0, updated: 0, cancelled: 0, skipped: 0, linkedClients: 0 };
  if (!(await googleConnected())) {
    return { ok: false, ...empty, message: "Google Calendar is not connected." };
  }

  const now = new Date();
  const timeMin = new Date(now.getTime() - WINDOW_BACK_DAYS * 86_400_000);
  const timeMax = new Date(now.getTime() + WINDOW_FORWARD_DAYS * 86_400_000);
  const cal = encodeURIComponent(await calendarId());

  // Page through the whole window. singleEvents expands recurring series.
  const events: GEvent[] = [];
  let pageToken: string | undefined;
  do {
    const page = await gcal<{ items?: GEvent[]; nextPageToken?: string }>(`/calendars/${cal}/events`, {
      query: {
        singleEvents: "true",
        showDeleted: "true",
        orderBy: "startTime",
        maxResults: "2500",
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        pageToken,
      },
    });
    events.push(...(page.items ?? []));
    pageToken = page.nextPageToken;
  } while (pageToken);

  const clients = await prisma.client.findMany({ select: { id: true, name: true, email: true } });
  const clientIds = new Set(clients.map((c) => c.id));
  const existing = await prisma.job.findMany({
    where: { gcalEventId: { in: events.map((e) => e.id) } },
  });
  const byEventId = new Map(existing.map((j) => [j.gcalEventId as string, j]));

  const r = { ...empty };

  for (const e of events) {
    const job = byEventId.get(e.id);

    if (e.status === "cancelled") {
      if (!job) continue;
      const hasWork = Number(job.laborCost) > 0 || job.chargeAmount != null || job.status === "DONE";
      if (hasWork) {
        // Never delete something with money attached. Park it instead.
        await prisma.job.update({ where: { id: job.id }, data: { status: "CANCELED", syncedAt: now } });
      } else {
        await prisma.job.delete({ where: { id: job.id } });
      }
      r.cancelled++;
      continue;
    }

    const start = eventStart(e);
    if (!start) { r.skipped++; continue; }
    const end = eventEnd(e, start.allDay);
    const gUpdated = e.updated ? new Date(e.updated) : null;

    const scheduling = {
      title: e.summary?.trim() || "(no title)",
      date: start.date,
      allDay: start.allDay,
      endDate: end,
      location: e.location ?? null,
      durationMin: end && !start.allDay ? Math.round((end.getTime() - start.date.getTime()) / 60_000) : null,
      gcalSeriesId: e.recurringEventId ?? null,
      gcalUpdated: gUpdated,
      syncedAt: now,
    };

    if (!job) {
      const clientId = matchClient(e, clients, clientIds);
      if (clientId) r.linkedClients++;
      await prisma.job.create({
        data: {
          ...scheduling,
          gcalEventId: e.id,
          clientId,
          notes: stripBlock(e.description) || null,
          status: "SCHEDULED",
        },
      });
      r.created++;
      continue;
    }

    // Google only wins when it is genuinely newer than what we last saw.
    const stale = job.gcalUpdated && gUpdated && gUpdated <= job.gcalUpdated;
    if (stale) { r.skipped++; continue; }

    // Backfill a client link if we still do not have one, but never replace one.
    let clientId = job.clientId;
    if (!clientId) {
      clientId = matchClient(e, clients, clientIds);
      if (clientId) r.linkedClients++;
    }

    await prisma.job.update({
      where: { id: job.id },
      data: {
        ...scheduling,
        clientId,
        notes: stripBlock(e.description) || null,
        // status, laborCost, chargeAmount, workerId deliberately untouched
      },
    });
    r.updated++;
  }

  const message = `${r.created} new, ${r.updated} updated, ${r.cancelled} removed${
    r.linkedClients ? `, ${r.linkedClients} matched to a client` : ""
  }`;
  await setState(KEY_LAST_SYNC, now.toISOString());
  await setState(KEY_SYNC_NOTE, message);
  return { ok: true, ...r, message };
}

// ---------------------------------------------------------------------- push

async function loadForPush(jobId: string) {
  return prisma.job.findUnique({
    where: { id: jobId },
    include: {
      client: { select: { name: true } },
      worker: { select: { name: true } },
      tasks: { select: { title: true, done: true }, orderBy: { createdAt: "asc" } },
    },
  });
}

/**
 * Mirror a CHM job onto the calendar. Creates the event if it has none yet.
 * Silent no-op when Google is not connected, so the app works without it.
 * Never throws into a server action: a calendar hiccup must not lose a save.
 */
export async function pushJob(jobId: string): Promise<void> {
  try {
    if (!(await googleConnected())) return;
    const job = await loadForPush(jobId);
    if (!job) return;

    const cal = encodeURIComponent(await calendarId());
    const body = toGoogleEvent(job);

    if (job.gcalEventId) {
      const res = await gcal<GEvent>(`/calendars/${cal}/events/${encodeURIComponent(job.gcalEventId)}`, {
        method: "PATCH",
        body,
      });
      await prisma.job.update({
        where: { id: job.id },
        data: { gcalUpdated: res.updated ? new Date(res.updated) : null, syncedAt: new Date() },
      });
    } else {
      const res = await gcal<GEvent>(`/calendars/${cal}/events`, { method: "POST", body });
      await prisma.job.update({
        where: { id: job.id },
        data: {
          gcalEventId: res.id,
          gcalUpdated: res.updated ? new Date(res.updated) : null,
          syncedAt: new Date(),
        },
      });
    }
  } catch (err) {
    console.error("[gcal] push failed for job", jobId, err);
  }
}

/** Remove the event behind a job. Called before the job row is deleted. */
export async function deleteJobEvent(gcalEventId: string | null): Promise<void> {
  if (!gcalEventId) return;
  try {
    if (!(await googleConnected())) return;
    const cal = encodeURIComponent(await calendarId());
    await gcal(`/calendars/${cal}/events/${encodeURIComponent(gcalEventId)}`, { method: "DELETE" });
  } catch (err) {
    // 404/410 just means it is already gone, which is the outcome we wanted.
    console.error("[gcal] delete failed for event", gcalEventId, err);
  }
}
