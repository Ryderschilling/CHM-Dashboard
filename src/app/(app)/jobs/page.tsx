import Link from "next/link";
import { prisma } from "@/lib/db";
import { num, fmtDate, fmtTime, toInputDate, monthStart } from "@/lib/format";
import { AddJobButton, JobActions, ReportVisitButton } from "@/components/launchers";
import { Empty } from "@/components/ui";
import StatTile from "@/components/StatTile";
import Reveal from "@/components/Reveal";
import CalendarSync from "@/components/CalendarSync";
import JobChecklist from "@/components/JobChecklist";
import { fmtDur, jobMinutes } from "@/lib/duration";
import { timeJobs, type StandardLite } from "@/lib/jobTime";
import { routeSort } from "@/lib/route";
import RouteOrder from "@/components/RouteOrder";
import {
  googleConfigured,
  googleConnected,
  getState,
  calendarId,
  listCalendars,
  KEY_LAST_SYNC,
  KEY_SYNC_NOTE,
} from "@/lib/google";

export const dynamic = "force-dynamic";

/** hh:mm for a time input, or null when the job is all day. */
function timeInput(d: Date | null, allDay: boolean): string | null {
  if (!d || allDay) return null;
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** "Today", "Tomorrow", else the weekday name. */
function dayLabel(d: Date, today: Date): string {
  const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return WEEKDAY[d.getDay()];
}

type View = "today" | "week" | "month" | "all" | "history";
const VIEWS: { key: View; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Next 7 days" },
  { key: "month", label: "Next 30 days" },
  { key: "all", label: "All upcoming" },
  { key: "history", label: "History" },
];

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ who?: string; new?: string; gcal?: string; view?: string }>;
}) {
  const sp = await searchParams;
  const who = sp.who ?? "";
  const view: View = VIEWS.find((v) => v.key === sp.view)?.key ?? "week";

  const configured = googleConfigured();
  const connected = configured ? await googleConnected() : false;

  const today = startOfDay(new Date());
  const thisMonth = monthStart(0);

  // Window per view. History looks backwards, everything else forwards.
  const horizon = view === "today" ? 1 : view === "week" ? 7 : view === "month" ? 30 : null;
  const windowEnd = horizon ? new Date(today.getTime() + horizon * 86_400_000) : null;

  const whereWho = who === "me" ? { workerId: null } : who ? { workerId: who } : {};
  const whereDate =
    view === "history"
      ? { date: { lt: today } }
      : windowEnd
        ? { date: { gte: today, lt: windowEnd } }
        : { date: { gte: today } };

  const [jobs, monthJobs, clients, workers, properties, lastSync, lastNote, calId, totalUpcoming] =
    await Promise.all([
      prisma.job.findMany({
        where: { ...whereWho, ...whereDate },
        include: {
          client: { select: { id: true, name: true, cadence: true, planAmount: true, visitsPerMonth: true } },
          worker: { select: { id: true, name: true } },
          tasks: { select: { id: true, title: true, done: true }, orderBy: { createdAt: "asc" } },
          visitReport: { select: { id: true } },
        },
        orderBy: view === "history" ? { date: "desc" } : { date: "asc" },
        take: 400,
      }),
      // Separate query so the tiles always mean "this month", whatever view is on.
      prisma.job.findMany({
        where: { date: { gte: thisMonth } },
        select: { id: true, status: true, laborMinutes: true, laborHours: true },
      }),
      prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.worker.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.property.findMany({ select: { id: true, clientId: true, address: true } }),
      getState(KEY_LAST_SYNC),
      getState(KEY_SYNC_NOTE),
      calendarId(),
      prisma.job.count({ where: { date: { gte: today }, status: "SCHEDULED" } }),
    ]);

  // Standard times, so "Done" opens with the number already in the box.
  const standards: StandardLite[] = await prisma.jobStandard.findMany({
    where: { active: true },
    select: { id: true, label: true, minutes: true, gcalSeriesId: true, titleMatch: true, active: true, clientId: true },
  });

  // Checklists for the "Report a visit" launcher in the header.
  const checkAreas = await prisma.propertyCheckArea.findMany({
    where: { active: true },
    select: { id: true, propertyId: true, label: true, category: true, sortOrder: true },
    orderBy: { sortOrder: "asc" },
  });

  let calendars: { id: string; summary: string }[] = [];
  if (connected) {
    try {
      calendars = (await listCalendars()).map((c) => ({ id: c.id, summary: c.summary ?? c.id }));
    } catch {
      calendars = [];
    }
  }

  // --- hours ---
  // No money on this page on purpose (2026-08-05). A plan client who also buys
  // random extra work made per-job dollars impossible to state honestly here,
  // so money lives on the Dashboard and on each client's page instead. What a
  // job page owes you is: did it happen, and how long did it take.
  const timed = timeJobs(jobs, standards);
  const doneMTD = monthJobs.filter((j) => j.status === "DONE");
  const monthMinutes = doneMTD.reduce((sum, j) => sum + (jobMinutes(j) ?? 0), 0);
  const monthTimed = doneMTD.filter((j) => jobMinutes(j) != null).length;
  const noClient = jobs.filter((j) => !j.clientId).length;

  // --- group by day ---
  const days: { key: string; date: Date; jobs: typeof jobs }[] = [];
  const byKey = new Map<string, (typeof days)[number]>();
  for (const j of jobs) {
    const k = dayKey(j.date);
    let bucket = byKey.get(k);
    if (!bucket) {
      bucket = { key: k, date: j.date, jobs: [] };
      byKey.set(k, bucket);
      days.push(bucket);
    }
    bucket.jobs.push(j);
  }
  // Inside a day the order is the order Ryder drives it, not the order Google
  // happened to hand it over in. See lib/route.ts.
  for (const d of days) d.jobs.sort(routeSort);

  const jobRow = (j: (typeof jobs)[number], i: number, arr: (typeof jobs)[number][]) => {
    const openSteps = j.tasks.filter((t) => !t.done).length;
    const est = timed.get(j.id);

    return (
      <div
        key={j.id}
        className="group flex items-start gap-3 px-4 py-2.5 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors"
      >
        {/* route order */}
        <div className="shrink-0 pt-1">
          <RouteOrder jobId={j.id} first={i === 0} last={i === arr.length - 1} />
        </div>

        {/* when */}
        <div className="shrink-0 w-[62px] pt-0.5 text-[12px] tabular-nums text-[var(--mut)]">
          <span className="block">{j.allDay ? `Stop ${i + 1}` : fmtTime(j.date)}</span>
          {est?.minutes != null && (
            <span className={`block text-[11px] ${est.source === "standard" ? "opacity-60" : ""}`}>
              {fmtDur(est.minutes)}
            </span>
          )}
        </div>

        {/* what */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[13.5px] font-medium ${j.status === "DONE" ? "text-[var(--mut)] line-through" : ""}`}>
              {j.title}
            </span>
            {j.gcalSeriesId && (
              <span className="badge badge-mut !text-[10px]" title="Repeating calendar event">repeats</span>
            )}
            {j.status === "DONE" && <span className="badge badge-good !text-[10px]">Done</span>}
            {j.status === "CANCELED" && <span className="badge badge-mut !text-[10px]">Canceled</span>}
          </div>
          <p className="text-[12px] text-[var(--mut)] truncate">
            {j.client ? (
              <Link
                href={`/clients/${j.client.id}`}
                className="hover:text-[var(--teal)] hover:underline underline-offset-2 transition-colors"
              >
                {j.client.name}
              </Link>
            ) : (
              "No client"
            )}
            {[j.location, j.worker?.name, j.jobType]
              .filter(Boolean)
              .map((bit) => `  ·  ${bit}`)
              .join("")}
          </p>
          {j.notes && (
            <p className="text-[12px] text-[var(--sec)] mt-0.5 whitespace-pre-line">{j.notes}</p>
          )}

          {j.tasks.length > 0 ? (
            <details className="mt-1.5">
              <summary className="text-[11.5px] text-[var(--mut)] cursor-pointer hover:text-[var(--teal)] transition-colors list-none">
                {openSteps > 0
                  ? `${j.tasks.length - openSteps}/${j.tasks.length} steps`
                  : `All ${j.tasks.length} steps done`}
              </summary>
              <div className="mt-2 max-w-[320px]">
                <JobChecklist jobId={j.id} tasks={j.tasks} />
              </div>
            </details>
          ) : (
            <div className="mt-0.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <JobChecklist jobId={j.id} tasks={[]} />
            </div>
          )}
        </div>

        {/* actions */}
        <div className="shrink-0 pt-0.5">
          <JobActions
            clients={clients}
            workers={workers}
            properties={properties}
            job={{
              id: j.id,
              clientId: j.clientId,
              propertyId: j.propertyId,
              title: j.title,
              jobType: j.jobType,
              date: toInputDate(j.date),
              startTime: timeInput(j.date, j.allDay),
              endTime: timeInput(j.endDate, j.allDay),
              allDay: j.allDay,
              location: j.location,
              status: j.status,
              workerId: j.workerId,
              laborCost: num(j.laborCost),
              laborMinutes: j.laborMinutes,
              chargeAmount: j.chargeAmount == null ? null : num(j.chargeAmount),
              durationMin: j.durationMin,
              notes: j.notes,
              gcalEventId: j.gcalEventId,
            }}
            suggestedMinutes={
              timed.get(j.id)?.source === "standard" ? timed.get(j.id)?.minutes : null
            }
            areas={checkAreas}
            visitReportId={j.visitReport?.id ?? null}
            visitDefaults={
              j.clientId
                ? {
                    clientId: j.clientId,
                    propertyId: j.propertyId,
                    jobId: j.id,
                    visitDate: toInputDate(j.date),
                    // Start from the measured time, else this job's standard.
                    minutesOnSite: timed.get(j.id)?.minutes ?? null,
                    chargeAmount: j.chargeAmount == null ? null : num(j.chargeAmount),
                    laborCost: num(j.laborCost) || null,
                  }
                : undefined
            }
          />
        </div>
      </div>
    );
  };

  const emptyText =
    view === "history"
      ? "Nothing in the past yet."
      : connected
        ? "Nothing scheduled in this window. Try a wider one, or hit Sync calendar."
        : "Nothing on the schedule. Connect Google Calendar to pull your route in.";

  return (
    <Reveal className="in">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow mb-1.5">Every visit, task, and project</p>
          <h1 className="display font-semibold text-[28px] leading-none tracking-tight" style={{ fontStretch: "118%" }}>
            Jobs
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CalendarSync
            configured={configured}
            connected={connected}
            lastSync={lastSync}
            lastNote={lastNote}
            calendars={calendars}
            currentCalendarId={calId}
          />
          <ReportVisitButton
            clients={clients}
            properties={properties}
            areas={checkAreas}
            primary={false}
          />
          <AddJobButton clients={clients} workers={workers} properties={properties} autoOpen={sp.new === "1"} />
        </div>
      </div>

      {sp.gcal && (
        <div className={`card p-3.5 mb-4 text-[13px] ${sp.gcal === "connected" ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>
          {sp.gcal === "connected"
            ? "Google Calendar connected. Hit Sync calendar to pull your events in."
            : sp.gcal}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile
          label="Done this month"
          value={doneMTD.length}
          accent
          sub={
            monthTimed < doneMTD.length
              ? `${doneMTD.length - monthTimed} still need a time`
              : "Every one is timed"
          }
          subTone={monthTimed < doneMTD.length ? "warn" : "good"}
        />
        <StatTile
          label="Hours this month"
          value={monthMinutes}
          duration
          sub={monthTimed > 0 ? `across ${monthTimed} logged job${monthTimed === 1 ? "" : "s"}` : "Nothing logged yet"}
        />
        <StatTile label="Scheduled ahead" value={totalUpcoming} sub="Still to come" />
        <StatTile
          label="No client linked"
          value={noClient}
          sub={noClient > 0 ? "In this view. Link them so they count." : "Everything in view is linked"}
          subTone={noClient > 0 ? "warn" : "good"}
        />
      </div>

      {/* View tabs */}
      <div className="flex gap-1.5 mb-3 flex-wrap items-center">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/jobs?view=${v.key}${who ? `&who=${who}` : ""}`}
            className={`btn btn-sm ${view === v.key ? "btn-primary" : ""}`}
          >
            {v.label}
          </Link>
        ))}
        <span className="text-[11.5px] text-[var(--mut)] ml-1">{totalUpcoming} scheduled ahead</span>
      </div>

      {/* Who filter */}
      <div className="flex gap-1.5 mb-4 flex-wrap items-center">
        <Link href={`/jobs?view=${view}`} className={`btn btn-sm ${!who ? "btn-primary" : ""}`}>Everyone</Link>
        <Link href={`/jobs?view=${view}&who=me`} className={`btn btn-sm ${who === "me" ? "btn-primary" : ""}`}>Me</Link>
        {workers.map((w) => (
          <Link key={w.id} href={`/jobs?view=${view}&who=${w.id}`} className={`btn btn-sm ${who === w.id ? "btn-primary" : ""}`}>
            {w.name}
          </Link>
        ))}
      </div>

      {days.length === 0 ? (
        <div className="card"><Empty text={emptyText} /></div>
      ) : (
        <div className="space-y-3">
          {days.map((d) => {
            const dayMinutes = d.jobs.reduce((s, j) => s + (timed.get(j.id)?.minutes ?? 0), 0);
            const dayUnknown = d.jobs.filter((j) => timed.get(j.id)?.source === "unknown").length;
            const isToday = dayKey(d.date) === dayKey(today);
            return (
              <div key={d.key} className={`card overflow-hidden ${isToday ? "ring-1 ring-[var(--teal)]/40" : ""}`}>
                <div className="flex items-baseline justify-between gap-3 px-4 pt-3.5 pb-2.5 border-b border-[var(--border)]">
                  <div className="flex items-baseline gap-2.5">
                    <span
                      className={`display font-semibold text-[14px] ${isToday ? "text-[var(--teal)]" : ""}`}
                      style={{ fontStretch: "112%" }}
                    >
                      {dayLabel(d.date, today)}
                    </span>
                    <span className="text-[12px] text-[var(--mut)]">{fmtDate(d.date)}</span>
                  </div>
                  <span className="text-[12px] text-[var(--mut)] tabular-nums">
                    {d.jobs.length} {d.jobs.length === 1 ? "stop" : "stops"}
                    {dayMinutes > 0 ? ` · ${fmtDur(dayMinutes)}${dayUnknown ? "+" : ""}` : ""}
                  </span>
                </div>
                <div>{d.jobs.map(jobRow)}</div>
              </div>
            );
          })}
        </div>
      )}
    </Reveal>
  );
}
