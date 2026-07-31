/**
 * Read-only Google Calendar feed.
 *
 * Reads the secret iCal address(es) from GOOGLE_CALENDAR_ICS_URLS
 * (comma-separated for multiple calendars), expands recurring events,
 * and returns the next N days. The app never writes to the calendar.
 */
import ical, { type CalendarComponent, type VEvent } from "node-ical";

export type CalEvent = {
  title: string;
  start: string; // ISO
  end: string | null;
  allDay: boolean;
  location: string | null;
};

export function calendarConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CALENDAR_ICS_URLS?.trim());
}

function isVEvent(c: CalendarComponent): c is VEvent {
  return c.type === "VEVENT";
}

/** node-ical fields can be a string or {params, val}. Normalize to string. */
function txt(v: unknown): string {
  if (typeof v === "string") return v;
  if (v && typeof v === "object" && "val" in v) return String((v as { val: unknown }).val ?? "");
  return "";
}

export async function getCalendarEvents(days = 10): Promise<CalEvent[]> {
  const urls = (process.env.GOOGLE_CALENDAR_ICS_URLS ?? "")
    .split(",")
    .map((u) => u.trim())
    .filter(Boolean);
  if (!urls.length) return [];

  const now = new Date();
  const windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const windowEnd = new Date(windowStart.getTime() + days * 86_400_000);
  const out: CalEvent[] = [];

  for (const url of urls) {
    let text: string;
    try {
      const res = await fetch(url, { next: { revalidate: 600 } });
      if (!res.ok) continue;
      text = await res.text();
    } catch {
      continue; // feed unreachable, skip quietly
    }

    let parsed: ReturnType<typeof ical.sync.parseICS>;
    try {
      parsed = ical.sync.parseICS(text);
    } catch {
      continue;
    }

    for (const item of Object.values(parsed)) {
      if (!item || !isVEvent(item)) continue;
      const durationMs =
        item.end && item.start ? item.end.getTime() - item.start.getTime() : 0;
      const allDay = (item.datetype as string | undefined) === "date";

      if (item.rrule) {
        // Recurring: expand instances inside the window
        const instances = item.rrule.between(windowStart, windowEnd, true);
        const exdates = new Set(
          Object.values(item.exdate ?? {}).map((d) => (d as Date).toISOString().slice(0, 10))
        );
        for (const inst of instances) {
          if (exdates.has(inst.toISOString().slice(0, 10))) continue;
          out.push({
            title: txt(item.summary) || "Busy",
            start: inst.toISOString(),
            end: durationMs ? new Date(inst.getTime() + durationMs).toISOString() : null,
            allDay,
            location: txt(item.location) || null,
          });
        }
      } else if (item.start && item.start >= windowStart && item.start < windowEnd) {
        out.push({
          title: txt(item.summary) || "Busy",
          start: item.start.toISOString(),
          end: item.end ? item.end.toISOString() : null,
          allDay,
          location: txt(item.location) || null,
        });
      }
    }
  }

  return out.sort((a, b) => a.start.localeCompare(b.start));
}
