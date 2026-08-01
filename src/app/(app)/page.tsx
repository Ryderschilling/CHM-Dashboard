import Link from "next/link";
import { getDashboard } from "@/lib/metrics";
import { getCalendarEvents, calendarConfigured } from "@/lib/gcal";
import { money, fmtDate, fmtTime } from "@/lib/format";
import StatTile from "@/components/StatTile";
import Reveal from "@/components/Reveal";
import BarChart from "@/components/charts/BarChart";
import HBarList from "@/components/charts/HBarList";
import { SectionHeader, Empty, StatusBadge } from "@/components/ui";
import { IconAlert, IconArrowRight } from "@/components/icons";

export const dynamic = "force-dynamic";

const DAY_GREETING = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function Dashboard() {
  const [d, calEvents] = await Promise.all([getDashboard(), getCalendarEvents(10)]);
  const now = new Date();

  const agenda = [
    ...d.upcomingJobs.map((j) => ({
      key: `j${j.id}`,
      kind: "job" as const,
      title: j.title,
      when: j.date,
      sub: `${j.clientName ?? "No client"}${j.workerName ? ` · ${j.workerName}` : " · You"}`,
    })),
    ...calEvents.map((e, i) => ({
      key: `c${i}`,
      kind: "cal" as const,
      title: e.title,
      when: e.start,
      sub: e.allDay ? "All day" : `${fmtTime(e.start)}${e.location ? ` · ${e.location}` : ""}`,
    })),
  ]
    .sort((a, b) => a.when.localeCompare(b.when))
    .slice(0, 9);

  return (
    <div className="aurora -mx-4 md:-mx-8 px-4 md:px-8 pt-2">
      {/* Header */}
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
          <div>
            <p className="eyebrow mb-1.5">{DAY_GREETING[now.getDay()]}, {fmtDate(now)}</p>
            <h1 className="display font-semibold text-[30px] leading-none tracking-tight" style={{ fontStretch: "118%" }}>
              Command Center
            </h1>
          </div>
          <div className="flex gap-2">
            <Link href="/money?new=1" className="btn btn-primary">Log payment</Link>
            <Link href="/jobs?new=1" className="btn">Add job</Link>
            <Link href="/tasks?new=1" className="btn">Add task</Link>
          </div>
        </div>
      </Reveal>

      {/* Stat tiles */}
      <Reveal delay={60}>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 mb-4">
          <StatTile
            label="MRR"
            value={d.mrr}
            money
            accent
            delta={
              d.mrrDeltaPct === null
                ? null
                : {
                    pct: d.mrrDeltaPct,
                    title: `Recurring base vs ${money(d.mrrAvg)} average monthly profit over the last ${d.mrrAvgMonths} month${d.mrrAvgMonths > 1 ? "s" : ""} (collected minus labor and expenses)`,
                  }
            }
            sub={
              d.missingPlanAmounts > 0
                ? `${d.missingPlanAmounts} client${d.missingPlanAmounts > 1 ? "s" : ""} missing a plan amount`
                : d.mrrAvg > 0
                  ? `vs ${money(d.mrrAvg)} avg monthly profit`
                  : "Monthly recurring"
            }
            subTone={d.missingPlanAmounts > 0 ? "warn" : "mut"}
          />
          <StatTile label="Collected this month" value={d.collectedMTD} money sub="Money actually in" />
          <StatTile
            label="Waiting on"
            value={d.outstanding}
            money
            sub={
              d.overdueCount > 0
                ? `${money(d.overdue)} overdue`
                : d.upcomingSum > 0
                  ? `+${money(d.upcomingSum)} scheduled soon`
                  : "Nothing overdue"
            }
            subTone={d.overdueCount > 0 ? "bad" : d.upcomingSum > 0 ? "mut" : "good"}
          />
          <StatTile
            label="Profit this month"
            value={d.profitMTD}
            money
            sub="After labor and expenses"
            subTone={d.profitMTD >= 0 ? "good" : "bad"}
          />
          <StatTile label="Labor + expenses" value={d.laborMTD + d.expensesMTD} money sub="Cost this month" />
          <StatTile label="Active clients" value={d.activeCount} sub="Recurring and a la carte" />
        </div>
      </Reveal>

      {/* Charts */}
      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Reveal delay={100}>
          <div className="card p-5">
            <SectionHeader title="Revenue" sub="Collected by month, last 12 months" />
            <BarChart data={d.revenue12} seriesA="Collected" />
          </div>
        </Reveal>
        <Reveal delay={150}>
          <div className="card p-5">
            <SectionHeader title="Money in vs costs" sub="Labor plus expenses against collections, last 6 months" />
            <BarChart data={d.inOut6} seriesA="Money in" seriesB="Costs" />
          </div>
        </Reveal>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mb-8">
        {/* Top clients */}
        <Reveal delay={100}>
          <div className="card p-5 h-full">
            <SectionHeader
              title="Top clients"
              sub={`Collected in ${now.getFullYear()}`}
              action={
                <Link href="/clients" className="text-[12.5px] text-[var(--teal)] inline-flex items-center gap-1">
                  All clients <IconArrowRight size={12} />
                </Link>
              }
            />
            {d.topClients.length ? (
              <HBarList rows={d.topClients} />
            ) : (
              <Empty text="No collected payments yet this year." />
            )}
          </div>
        </Reveal>

        {/* Upcoming jobs */}
        <Reveal delay={150}>
          <div className="card p-5 h-full">
            <SectionHeader
              title="Coming up"
              sub="Jobs and calendar, next 10 days"
              action={
                <Link href="/jobs" className="text-[12.5px] text-[var(--teal)] inline-flex items-center gap-1">
                  All jobs <IconArrowRight size={12} />
                </Link>
              }
            />
            {agenda.length ? (
              <div className="space-y-1">
                {agenda.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--border)] last:border-0">
                    <div className="min-w-0 flex items-center gap-2.5">
                      <span
                        className={`shrink-0 w-1.5 h-1.5 rounded-full ${item.kind === "job" ? "bg-[var(--teal)]" : "bg-[var(--s2)]"}`}
                        title={item.kind === "job" ? "Job" : "Calendar"}
                      />
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-medium truncate">{item.title}</p>
                        <p className="text-[12px] text-[var(--mut)] truncate">{item.sub}</p>
                      </div>
                    </div>
                    <span className="text-[12.5px] text-[var(--sec)] shrink-0">{fmtDate(item.when)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="Nothing scheduled. Add a job to get it on the board." />
            )}
            {!calendarConfigured() && (
              <p className="text-[11.5px] text-[var(--mut)] mt-3 pt-3 border-t border-[var(--border)]">
                Tip: paste your Google Calendar secret iCal address into .env
                (GOOGLE_CALENDAR_ICS_URLS) and your schedule shows up here.
              </p>
            )}
          </div>
        </Reveal>

        {/* Needs attention */}
        <Reveal delay={200}>
          <div className="card p-5 h-full">
            <SectionHeader title="Needs attention" sub="Overdue money and tasks" />
            {d.attention.length ? (
              <div className="space-y-2">
                {d.attention.map((a) => (
                  <Link
                    key={`${a.kind}-${a.id}`}
                    href={a.href}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg bg-[rgba(229,72,77,0.06)] border border-[rgba(229,72,77,0.2)] hover:border-[rgba(229,72,77,0.45)] transition-colors"
                  >
                    <span className="text-[var(--bad)] shrink-0"><IconAlert size={14} /></span>
                    <span className="text-[13px] truncate">{a.text}</span>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-[13px] text-[var(--good)]">All clear. Nothing overdue.</p>
              </div>
            )}

            {d.dueSoonTasks.length > 0 && (
              <>
                <p className="eyebrow mt-5 mb-2">Open tasks</p>
                <div className="space-y-1">
                  {d.dueSoonTasks.map((t) => (
                    <Link key={t.id} href="/tasks" className="flex items-center justify-between gap-3 py-1.5 group">
                      <span className="text-[13px] text-[var(--sec)] group-hover:text-[var(--ink)] transition-colors truncate">
                        {t.title}
                      </span>
                      <span className="shrink-0 flex items-center gap-2">
                        {t.priority === "HIGH" && <StatusBadge status="HIGH" />}
                        {t.due && <span className="text-[11.5px] text-[var(--mut)]">{fmtDate(t.due)}</span>}
                      </span>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </Reveal>
      </div>
    </div>
  );
}
