import Link from "next/link";
import { prisma } from "@/lib/db";
import { money, num, fmtDate, fmtTime, toInputDate, monthStart } from "@/lib/format";
import { AddJobButton, JobActions } from "@/components/launchers";
import { StatusBadge, Empty } from "@/components/ui";
import StatTile from "@/components/StatTile";
import Reveal from "@/components/Reveal";
import CalendarSync from "@/components/CalendarSync";
import JobChecklist from "@/components/JobChecklist";
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

export default async function JobsPage({
  searchParams,
}: {
  searchParams: Promise<{ who?: string; new?: string; gcal?: string }>;
}) {
  const sp = await searchParams;
  const who = sp.who ?? "";

  const configured = googleConfigured();
  const connected = configured ? await googleConnected() : false;

  const [jobs, clients, workers, properties, lastSync, lastNote, calId] = await Promise.all([
    prisma.job.findMany({
      where: who === "me" ? { workerId: null } : who ? { workerId: who } : {},
      include: {
        client: { select: { id: true, name: true } },
        worker: { select: { id: true, name: true } },
        tasks: { select: { id: true, title: true, done: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { date: "desc" },
      take: 300,
    }),
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.worker.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.property.findMany({ select: { id: true, clientId: true, address: true } }),
    getState(KEY_LAST_SYNC),
    getState(KEY_SYNC_NOTE),
    calendarId(),
  ]);

  // Calendar list is a live API call, so only when connected and never fatal.
  let calendars: { id: string; summary: string }[] = [];
  if (connected) {
    try {
      calendars = (await listCalendars()).map((c) => ({ id: c.id, summary: c.summary ?? c.id }));
    } catch {
      calendars = [];
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisMonth = monthStart(0);

  const upcoming = jobs
    .filter((j) => j.status === "SCHEDULED" && j.date >= today)
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const past = jobs.filter((j) => !(j.status === "SCHEDULED" && j.date >= today));

  const doneMTD = jobs.filter((j) => j.status === "DONE" && j.date >= thisMonth);
  const laborMTD = doneMTD.reduce((s, j) => s + num(j.laborCost), 0);
  const chargedMTD = doneMTD.reduce((s, j) => s + (j.chargeAmount == null ? 0 : num(j.chargeAmount)), 0);
  const missingLabor = doneMTD.filter((j) => num(j.laborCost) === 0).length;
  const fromCalendar = jobs.filter((j) => j.gcalEventId).length;

  const row = (j: (typeof jobs)[number]) => {
    const spread = (j.chargeAmount == null ? 0 : num(j.chargeAmount)) - num(j.laborCost);
    return (
      <tr key={j.id} className="tr-row align-top">
        <td className="td text-[12.5px] text-[var(--mut)] whitespace-nowrap">
          {fmtDate(j.date)}
          {!j.allDay && <span className="block text-[11.5px]">{fmtTime(j.date)}</span>}
        </td>
        <td className="td">
          <span className="font-medium text-[13.5px] inline-flex items-center gap-1.5">
            {j.title}
            {j.gcalSeriesId && (
              <span className="badge badge-mut !text-[10px]" title="One occurrence of a repeating calendar event">
                repeats
              </span>
            )}
          </span>
          {j.client ? (
            <Link href={`/clients/${j.client.id}`} className="block text-[12px] text-[var(--mut)] hover:text-[var(--teal)] transition-colors">
              {j.client.name}
            </Link>
          ) : (
            <span className="block text-[12px] text-[var(--mut)]">No client</span>
          )}
          {j.location && <span className="block text-[11.5px] text-[var(--mut)]">{j.location}</span>}
          <div className="mt-2 max-w-[300px]">
            <JobChecklist jobId={j.id} tasks={j.tasks} />
          </div>
        </td>
        <td className="td">
          <span className={`badge ${j.worker ? "badge-mut" : "badge-teal"}`}>{j.worker?.name ?? "You"}</span>
        </td>
        <td className="td text-right tabular-nums text-[13px]">
          {num(j.laborCost) > 0 ? (
            money(j.laborCost)
          ) : j.status === "DONE" ? (
            <span className="text-[var(--warn)]" title="Done with no labor cost, so profit is overstated">
              not set
            </span>
          ) : (
            <span className="text-[var(--mut)]">-</span>
          )}
        </td>
        <td className="td text-right tabular-nums text-[13px]">{j.chargeAmount != null ? money(j.chargeAmount) : <span className="text-[var(--mut)]">plan</span>}</td>
        <td className="td text-right tabular-nums text-[13px]">
          {j.chargeAmount != null ? (
            <span className={spread >= 0 ? "text-[var(--good)]" : "text-[var(--bad)]"}>{money(spread)}</span>
          ) : (
            <span className="text-[var(--mut)]">-</span>
          )}
        </td>
        <td className="td"><StatusBadge status={j.status} /></td>
        <td className="td text-right">
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
              chargeAmount: j.chargeAmount == null ? null : num(j.chargeAmount),
              durationMin: j.durationMin,
              notes: j.notes,
              gcalEventId: j.gcalEventId,
            }}
          />
        </td>
      </tr>
    );
  };

  const head = (
    <thead>
      <tr className="border-b border-[var(--border)]">
        <th className="th">When</th>
        <th className="th">Job</th>
        <th className="th">Who</th>
        <th className="th text-right">Labor</th>
        <th className="th text-right">Charge</th>
        <th className="th text-right">Spread</th>
        <th className="th">Status</th>
        <th className="th" />
      </tr>
    </thead>
  );

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
          <AddJobButton clients={clients} workers={workers} properties={properties} autoOpen={sp.new === "1"} />
        </div>
      </div>

      {sp.gcal && (
        <div
          className={`card p-3.5 mb-4 text-[13px] ${
            sp.gcal === "connected" ? "text-[var(--good)]" : "text-[var(--bad)]"
          }`}
        >
          {sp.gcal === "connected"
            ? "Google Calendar connected. Hit Sync calendar to pull your events in."
            : sp.gcal}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile label="Done this month" value={doneMTD.length} accent />
        <StatTile label="Charged this month" value={chargedMTD} money sub="On top of plans" />
        <StatTile
          label="Labor this month"
          value={laborMTD}
          money
          sub={missingLabor > 0 ? `${missingLabor} done with no cost set` : "All costed"}
          subTone={missingLabor > 0 ? "warn" : "good"}
        />
        <StatTile
          label="Spread this month"
          value={chargedMTD - laborMTD}
          money
          subTone={chargedMTD - laborMTD >= 0 ? "good" : "bad"}
          sub="Charges minus labor"
        />
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap items-center">
        <Link href="/jobs" className={`btn btn-sm ${!who ? "btn-primary" : ""}`}>All</Link>
        <Link href="/jobs?who=me" className={`btn btn-sm ${who === "me" ? "btn-primary" : ""}`}>Mine</Link>
        {workers.map((w) => (
          <Link key={w.id} href={`/jobs?who=${w.id}`} className={`btn btn-sm ${who === w.id ? "btn-primary" : ""}`}>
            {w.name}
          </Link>
        ))}
        {fromCalendar > 0 && (
          <span className="text-[11.5px] text-[var(--mut)] ml-1">{fromCalendar} linked to your calendar</span>
        )}
      </div>

      <div className="space-y-5">
        <div className="card overflow-x-auto">
          <p className="eyebrow px-4 pt-4">Upcoming ({upcoming.length})</p>
          {upcoming.length === 0 ? (
            <Empty
              text={
                connected
                  ? "Nothing on the schedule. Hit Sync calendar to pull your events in."
                  : "Nothing on the schedule. Connect Google Calendar to pull your route in."
              }
            />
          ) : (
            <table className="w-full min-w-[900px]">
              {head}
              <tbody>{upcoming.map(row)}</tbody>
            </table>
          )}
        </div>

        <div className="card overflow-x-auto">
          <p className="eyebrow px-4 pt-4">History</p>
          {past.length === 0 ? (
            <Empty text="No past jobs yet." />
          ) : (
            <table className="w-full min-w-[900px]">
              {head}
              <tbody>{past.map(row)}</tbody>
            </table>
          )}
        </div>
      </div>
    </Reveal>
  );
}
