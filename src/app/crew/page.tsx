import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCrewWorker } from "@/lib/crew";
import { fmtDate, fmtTime } from "@/lib/format";
import { Empty, StatusBadge } from "@/components/ui";
import Reveal from "@/components/Reveal";

export const dynamic = "force-dynamic";

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function dayLabel(d: Date, today: Date): string {
  const diff = Math.round((startOfDay(d).getTime() - today.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  return WEEKDAY[d.getDay()];
}

type View = "today" | "week" | "all" | "history";
const VIEWS: { key: View; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "Next 7 days" },
  { key: "all", label: "All upcoming" },
  { key: "history", label: "Past" },
];

export default async function CrewHome({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const worker = await getCrewWorker();
  const sp = await searchParams;
  const view: View = VIEWS.find((v) => v.key === sp.view)?.key ?? "today";

  const today = startOfDay(new Date());
  const horizon = view === "today" ? 1 : view === "week" ? 7 : null;
  const windowEnd = horizon ? new Date(today.getTime() + horizon * 86_400_000) : null;

  const whereDate =
    view === "history"
      ? { date: { lt: today } }
      : windowEnd
        ? { date: { gte: today, lt: windowEnd } }
        : { date: { gte: today } };

  const jobs = await prisma.job.findMany({
    where: { workerId: worker.id, ...whereDate },
    include: {
      client: { select: { name: true } },
      property: { select: { address: true } },
      tasks: { select: { done: true } },
    },
    orderBy: view === "history" ? { date: "desc" } : { date: "asc" },
    take: 100,
  });

  // Group by day, same shape as the admin jobs page.
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

  return (
    <Reveal className="in">
      <div className="mb-5">
        <p className="eyebrow mb-1.5">Your schedule</p>
        <h1 className="display font-semibold text-[26px] leading-none tracking-tight" style={{ fontStretch: "118%" }}>
          Hey {worker.name.split(" ")[0]}
        </h1>
      </div>

      <div className="flex gap-1.5 mb-4 flex-wrap">
        {VIEWS.map((v) => (
          <Link
            key={v.key}
            href={`/crew?view=${v.key}`}
            className={`btn btn-sm ${view === v.key ? "btn-primary" : ""}`}
          >
            {v.label}
          </Link>
        ))}
      </div>

      {days.length === 0 ? (
        <div className="card">
          <Empty
            text={
              view === "history"
                ? "No past jobs yet."
                : view === "today"
                  ? "Nothing on your plate today."
                  : "Nothing assigned to you in this window."
            }
          />
        </div>
      ) : (
        <div className="space-y-3">
          {days.map((d) => {
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
                    {d.jobs.length} {d.jobs.length === 1 ? "job" : "jobs"}
                  </span>
                </div>
                <div>
                  {d.jobs.map((j) => {
                    const doneSteps = j.tasks.filter((t) => t.done).length;
                    return (
                      <Link
                        key={j.id}
                        href={`/crew/jobs/${j.id}`}
                        className="flex items-start gap-3 px-4 py-3 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-2)] transition-colors"
                      >
                        <div className="shrink-0 w-[62px] pt-0.5 text-[12px] tabular-nums text-[var(--mut)]">
                          {j.allDay ? "All day" : fmtTime(j.date)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[14px] font-medium ${j.status === "DONE" ? "text-[var(--mut)] line-through" : ""}`}>
                              {j.title}
                            </span>
                            {j.status !== "SCHEDULED" && <StatusBadge status={j.status} />}
                          </div>
                          <p className="text-[12px] text-[var(--mut)] truncate mt-0.5">
                            {[
                              j.client?.name,
                              j.property?.address ?? j.location,
                              j.tasks.length > 0 ? `${doneSteps}/${j.tasks.length} steps` : null,
                            ]
                              .filter(Boolean)
                              .join("  ·  ")}
                          </p>
                        </div>
                        <span className="shrink-0 pt-1 text-[var(--mut)]">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Reveal>
  );
}
