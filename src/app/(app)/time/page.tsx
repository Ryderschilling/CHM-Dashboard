import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  money,
  fmtMonth,
  fmtDate,
  parseMonthParam,
  monthParam,
} from "@/lib/format";
import { fmtHours, valueJobs } from "@/lib/jobValue";
import {
  clientTimeRows,
  timeJobs,
  totalHours,
  weekdayLoad,
  fmtMinutes,
  WEEKDAY_SHORT,
  type StandardLite,
} from "@/lib/jobTime";
import { AddJobStandardButton, JobStandardActions } from "@/components/launchers";
import { SectionHeader, Empty } from "@/components/ui";
import StatTile from "@/components/StatTile";
import Reveal from "@/components/Reveal";
import { IconChevronL, IconChevronR } from "@/components/icons";

export const dynamic = "force-dynamic";

/**
 * Time = the hours side of the business.
 *
 * Money answers "what did I collect". This page answers "what did it cost me
 * in hours, and is any of it worth doing". Two numbers drive it:
 *
 *   effective hours   Job.laborHours when measured, else the JobStandard.
 *   dollars per hour  the value lib/jobValue.ts already assigns, over hours.
 *
 * Deliberate: a job with no measured time and no standard is NOT counted as
 * zero hours. It lands in "Jobs with no time on them", which is the list Ryder
 * works down until the whole route is timed.
 *
 * The client table is month-scoped because plan allocation is monthly. The
 * weekly load section is not, it is a forward look at the next 28 days.
 */

const WEEKS_AHEAD = 4;

export default async function TimePage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>;
}) {
  const sp = await searchParams;
  const month = parseMonthParam(sp.m);
  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const prevMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const thisMonth = parseMonthParam(undefined);
  const isCurrentMonth = month.getTime() === thisMonth.getTime();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ahead = new Date(today.getTime() + WEEKS_AHEAD * 7 * 86_400_000);
  const week = new Date(today.getTime() + 7 * 86_400_000);

  const jobInclude = {
    client: { select: { id: true, name: true, cadence: true, planAmount: true } },
  } as const;

  const [standardRows, monthJobs, aheadJobs, clients, properties] = await Promise.all([
    prisma.jobStandard.findMany({
      include: {
        client: { select: { id: true, name: true } },
        property: { select: { address: true } },
      },
      orderBy: [{ active: "desc" }, { label: "asc" }],
    }),
    prisma.job.findMany({
      where: { date: { gte: month, lt: nextMonth }, status: { not: "CANCELED" } },
      include: jobInclude,
      orderBy: { date: "asc" },
    }),
    prisma.job.findMany({
      where: { date: { gte: today, lt: ahead }, status: { not: "CANCELED" } },
      include: jobInclude,
      orderBy: { date: "asc" },
    }),
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.property.findMany({ select: { id: true, clientId: true, address: true } }),
  ]);

  const standards: StandardLite[] = standardRows.map((s) => ({
    id: s.id,
    label: s.label,
    minutes: s.minutes,
    gcalSeriesId: s.gcalSeriesId,
    titleMatch: s.titleMatch,
    active: s.active,
    clientId: s.clientId,
  }));

  /* ── Numbers ────────────────────────────────────────────────────────── */

  const monthTimes = timeJobs(monthJobs, standards);
  const monthHours = totalHours(monthJobs, standards);
  // Value every job in one pass, clientless ones included, so the headline
  // rate is total work over total hours and not a subset of either.
  const monthValues = valueJobs(monthJobs);
  const monthValue = monthJobs.reduce((s, j) => s + (monthValues.get(j.id)?.value ?? 0), 0);
  const monthPerHour = monthHours > 0 ? monthValue / monthHours : 0;

  const rows = clientTimeRows(monthJobs, standards)
    .filter((r) => r.visits > 0)
    .sort((a, b) => {
      // Worst dollars-per-hour first. That is the list worth acting on.
      if (a.perHour == null) return 1;
      if (b.perHour == null) return -1;
      return a.perHour - b.perHour;
    });

  const weekJobs = aheadJobs.filter((j) => j.date < week);
  const weekHours = totalHours(weekJobs, standards);
  const typicalWeek = totalHours(aheadJobs, standards) / WEEKS_AHEAD;
  const byWeekday = weekdayLoad(aheadJobs, standards, WEEKS_AHEAD);
  const peakDay = [...byWeekday].sort((a, b) => b.hours - a.hours)[0];
  const maxDayHours = Math.max(0.01, ...byWeekday.map((d) => d.hours));

  // Everything on the calendar over the next four weeks that we still cannot
  // put a number on, grouped so one fix covers the whole repeating series.
  type Untimed = {
    key: string;
    title: string;
    gcalSeriesId: string | null;
    clientId: string | null;
    clientName: string | null;
    count: number;
    next: Date;
  };
  const untimed = new Map<string, Untimed>();
  const aheadTimes = timeJobs(aheadJobs, standards);
  for (const j of aheadJobs) {
    if (aheadTimes.get(j.id)?.source !== "unknown") continue;
    const key = j.gcalSeriesId ?? `title:${j.title.toLowerCase()}`;
    const row = untimed.get(key);
    if (row) {
      row.count += 1;
      continue;
    }
    untimed.set(key, {
      key,
      title: j.title,
      gcalSeriesId: j.gcalSeriesId,
      clientId: j.clientId,
      clientName: j.client?.name ?? null,
      count: 1,
      next: j.date,
    });
  }
  const untimedList = [...untimed.values()].sort((a, b) => b.count - a.count);

  const monthTimed = monthJobs.filter((j) => monthTimes.get(j.id)?.source !== "unknown").length;
  const coverage = monthJobs.length ? Math.round((monthTimed / monthJobs.length) * 100) : 100;

  return (
    <Reveal className="in">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow mb-1.5">What the work actually costs you in hours</p>
          <h1
            className="display font-semibold text-[28px] leading-none tracking-tight"
            style={{ fontStretch: "118%" }}
          >
            Time
          </h1>
        </div>
        <AddJobStandardButton clients={clients} properties={properties} />
      </div>

      {/* Month nav */}
      <div className="flex flex-wrap items-center gap-1 mb-4">
        <Link href={`/time?m=${monthParam(prevMonth)}`} className="btn btn-sm">
          <IconChevronL size={14} />
        </Link>
        <span
          className="display font-semibold text-[15px] px-2 min-w-[110px] text-center"
          style={{ fontStretch: "112%" }}
        >
          {fmtMonth(month)}
        </span>
        <Link href={`/time?m=${monthParam(nextMonth)}`} className="btn btn-sm">
          <IconChevronR size={14} />
        </Link>
        {!isCurrentMonth && (
          <Link href="/time" className="btn btn-sm ml-1.5">This month</Link>
        )}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile
          label="Your rate per hour"
          value={monthPerHour}
          money
          accent
          sub={`${money(monthValue)} of work over ${fmtHours(monthHours) || "0h"}`}
        />
        <StatTile
          label={`Hours in ${fmtMonth(month)}`}
          value={monthHours}
          sub={`${monthJobs.length} visits`}
        />
        <StatTile
          label="A normal week"
          value={typicalWeek}
          sub={
            peakDay && peakDay.hours > 0
              ? `Heaviest day is ${WEEKDAY_SHORT[peakDay.day]}, about ${fmtHours(peakDay.hours)}`
              : "Nothing on the calendar yet"
          }
        />
        <StatTile
          label="Route timed"
          value={coverage}
          sub={
            untimedList.length
              ? `${untimedList.length} job${untimedList.length === 1 ? "" : "s"} still have no time`
              : "Every job on the calendar has a time"
          }
          subTone={untimedList.length ? "warn" : "good"}
        />
      </div>

      {/* ── Jobs with no time ───────────────────────────────────────────── */}
      {untimedList.length > 0 && (
        <div className="card p-5 mb-5" style={{ borderColor: "rgba(224,166,62,0.35)" }}>
          <SectionHeader
            title="Jobs with no time on them"
            sub="Time one of these once and every future occurrence counts itself. Until then they are invisible in the hours above."
          />
          <div className="space-y-1">
            {untimedList.map((u) => (
              <div
                key={u.key}
                className="flex items-center justify-between gap-3 py-2 border-b border-[var(--border)] last:border-0"
              >
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium truncate">{u.title}</p>
                  <p className="text-[12px] text-[var(--mut)]">
                    {u.count} time{u.count === 1 ? "" : "s"} in the next 4 weeks
                    {u.clientName ? ` · ${u.clientName}` : " · no client linked"} · next {fmtDate(u.next)}
                  </p>
                </div>
                <AddJobStandardButton
                  clients={clients}
                  properties={properties}
                  primary={false}
                  small
                  label="Set time"
                  defaults={{
                    label: u.title,
                    titleMatch: u.title,
                    clientId: u.clientId,
                    gcalSeriesId: u.gcalSeriesId,
                  }}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Weekly load ─────────────────────────────────────────────────── */}
      <div className="card p-5 mb-5">
        <SectionHeader
          title="Where the week goes"
          sub={`A typical day, averaged over the next ${WEEKS_AHEAD} weeks. The next 7 days are ${fmtHours(weekHours) || "empty"}.`}
        />
        {typicalWeek <= 0 ? (
          <Empty text="Nothing scheduled ahead, so there is no week to measure yet." />
        ) : (
          <div className="space-y-2">
            {byWeekday.map((d) => (
              <div key={d.day} className="flex items-center gap-3">
                <span className="w-9 shrink-0 text-[12px] text-[var(--mut)]">
                  {WEEKDAY_SHORT[d.day]}
                </span>
                <div className="flex-1 h-[10px] rounded-full bg-[var(--surface-2)] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.round((d.hours / maxDayHours) * 100)}%`,
                      background: "linear-gradient(90deg, #12a396, #2fd4c4)",
                    }}
                  />
                </div>
                <span className="w-24 shrink-0 text-right text-[12.5px] tabular-nums text-[var(--sec)]">
                  {d.hours > 0 ? fmtHours(d.hours) : "-"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Per client ──────────────────────────────────────────────────── */}
      <div className="card p-5 mb-5">
        <SectionHeader
          title="What each client pays per hour"
          sub={`${fmtMonth(month)}. Worst rate first. This is the raise list and the hand-it-off list.`}
        />
        {rows.length === 0 ? (
          <Empty text="No visits this month yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[var(--mut)] text-left">
                  <th className="font-medium pb-2 pr-3">Client</th>
                  <th className="font-medium pb-2 pr-3">Visits</th>
                  <th className="font-medium pb-2 pr-3">Each</th>
                  <th className="font-medium pb-2 pr-3">Hours</th>
                  <th className="font-medium pb-2 pr-3">Worth</th>
                  <th className="font-medium pb-2 pr-3">Per hour</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const tone =
                    r.perHour == null
                      ? "text-[var(--mut)]"
                      : r.perHour < 25
                        ? "text-[var(--bad)]"
                        : r.perHour < 50
                          ? "text-[var(--warn)]"
                          : "text-[var(--good)]";
                  return (
                    <tr key={r.clientId} className="border-t border-[var(--border)]">
                      <td className="py-2.5 pr-3">
                        <Link
                          href={`/clients/${r.clientId}`}
                          className="font-medium hover:text-[var(--teal)] transition-colors"
                        >
                          {r.name}
                        </Link>
                        {r.incomplete && (
                          <p className="text-[11.5px] text-[var(--warn)]">
                            {r.visits - r.timedVisits} visit
                            {r.visits - r.timedVisits === 1 ? "" : "s"} not timed
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-[var(--sec)]">{r.visits}</td>
                      <td className="py-2.5 pr-3 tabular-nums text-[var(--mut)]">
                        {r.avgMinutes ? fmtMinutes(r.avgMinutes) : "-"}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-[var(--sec)]">
                        {r.hours > 0 ? fmtHours(r.hours) : "-"}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-[var(--sec)]">
                        {money(r.value)}
                      </td>
                      <td className={`py-2.5 pr-3 tabular-nums font-medium ${tone}`}>
                        {r.perHour == null ? "-" : `${money(r.perHour)}/hr`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── The standards themselves ────────────────────────────────────── */}
      <div className="card p-5">
        <SectionHeader
          title="Standard times"
          sub="Time a job once, record it here, and every occurrence of it counts itself from then on."
          action={
            <AddJobStandardButton
              clients={clients}
              properties={properties}
              primary={false}
              label="Add a standard"
            />
          }
        />
        {standardRows.length === 0 ? (
          <Empty text="No standards yet. Time a job on your route and add the first one." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[var(--mut)] text-left">
                  <th className="font-medium pb-2 pr-3">Job</th>
                  <th className="font-medium pb-2 pr-3">Takes</th>
                  <th className="font-medium pb-2 pr-3">Client</th>
                  <th className="font-medium pb-2 pr-3">Matches on</th>
                  <th className="font-medium pb-2" />
                </tr>
              </thead>
              <tbody>
                {standardRows.map((s) => (
                  <tr
                    key={s.id}
                    className="border-t border-[var(--border)]"
                    style={s.active ? undefined : { opacity: 0.5 }}
                  >
                    <td className="py-2.5 pr-3">
                      <span className="font-medium">{s.label}</span>
                      {s.property?.address && (
                        <p className="text-[11.5px] text-[var(--mut)]">{s.property.address}</p>
                      )}
                      {s.notes && (
                        <p className="text-[11.5px] text-[var(--mut)]">{s.notes}</p>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 tabular-nums text-[var(--sec)]">
                      {fmtMinutes(s.minutes)}
                    </td>
                    <td className="py-2.5 pr-3">
                      {s.client ? (
                        <Link
                          href={`/clients/${s.client.id}`}
                          className="hover:text-[var(--teal)] transition-colors"
                        >
                          {s.client.name}
                        </Link>
                      ) : (
                        <span className="text-[var(--mut)]">Not set</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-[var(--mut)]">
                      {s.gcalSeriesId ? "Calendar series" : s.titleMatch ? `"${s.titleMatch}"` : "-"}
                    </td>
                    <td className="py-2.5 text-right">
                      <JobStandardActions
                        clients={clients}
                        properties={properties}
                        standard={{
                          id: s.id,
                          label: s.label,
                          minutes: s.minutes,
                          clientId: s.clientId,
                          propertyId: s.propertyId,
                          gcalSeriesId: s.gcalSeriesId,
                          titleMatch: s.titleMatch,
                          active: s.active,
                          notes: s.notes,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Reveal>
  );
}
