import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getReport, loadFormOptions, minutesLabel, fmtBytes } from "@/lib/visits";
import { valueJobs, fmtHours } from "@/lib/jobValue";
import { money, num, fmtDate, toInputDate } from "@/lib/format";
import { categoryRank, STATE_LABEL } from "@/lib/checkAreas";
import { VisitReportActions } from "@/components/launchers";
import { SectionHeader, StatusBadge, Empty } from "@/components/ui";
import PhotoManager from "@/components/PhotoManager";
import Reveal from "@/components/Reveal";

export const dynamic = "force-dynamic";

export default async function VisitDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [r, opts] = await Promise.all([getReport(id), loadFormOptions()]);
  if (!r) notFound();

  const grouped = [...new Set(r.findings.map((f) => f.category))]
    .sort((a, b) => categoryRank(a) - categoryRank(b))
    .map((c) => [c, r.findings.filter((f) => f.category === c)] as const);

  const issues = r.findings.filter((f) => f.state === "ISSUE");
  const checked = r.findings.filter((f) => f.state !== "NA").length;

  // What this visit is worth against what the client actually pays.
  // valueJobs needs the client's WHOLE month, because a monthly plan is split
  // across that month's visits. Pulling one job in isolation would read high.
  const mStart = new Date(r.visitDate.getFullYear(), r.visitDate.getMonth(), 1);
  const mEnd = new Date(r.visitDate.getFullYear(), r.visitDate.getMonth() + 1, 1);
  const [plan, monthJobs] = await Promise.all([
    prisma.client.findUnique({
      where: { id: r.clientId },
      select: { planName: true, planAmount: true, cadence: true },
    }),
    prisma.job.findMany({
      where: { clientId: r.clientId, date: { gte: mStart, lt: mEnd }, status: { not: "CANCELED" } },
      include: { client: { select: { cadence: true, planAmount: true } } },
    }),
  ]);
  const v = r.jobId ? valueJobs(monthJobs).get(r.jobId) ?? null : null;
  const hours = r.minutesOnSite ? r.minutesOnSite / 60 : null;
  const outOfPocket = num(r.laborCost) + num(r.materialCost);
  const kept = v ? v.value - outOfPocket : null;
  const perHour = kept != null && hours ? kept / hours : null;

  return (
    <Reveal className="in">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div className="min-w-0">
          <p className="eyebrow mb-1.5">
            <Link href="/visits" className="hover:text-[var(--teal)]">Visits</Link>
            {" · "}
            <Link href={`/clients/${r.clientId}`} className="hover:text-[var(--teal)]">{r.client.name}</Link>
          </p>
          <h1 className="display font-semibold text-[28px] leading-none tracking-tight" style={{ fontStretch: "118%" }}>
            {fmtDate(r.visitDate)}
          </h1>
          <p className="text-[13px] text-[var(--mut)] mt-2">
            {r.property?.address ?? "No property on file"}
            {r.minutesOnSite ? ` · ${minutesLabel(r.minutesOnSite)} on site` : ""}
            {r.weather ? ` · ${r.weather}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={r.status} />
          <Link href={`/print/visit/${r.id}`} target="_blank" className="btn">
            Build the PDF
          </Link>
          <VisitReportActions
            clients={opts.clients}
            properties={opts.properties}
            areas={opts.areas}
            report={{
              id: r.id,
              status: r.status,
              clientId: r.clientId,
              propertyId: r.propertyId,
              jobId: r.jobId,
              visitDate: toInputDate(r.visitDate),
              minutesOnSite: r.minutesOnSite,
              weather: r.weather,
              summary: r.summary,
              internalNotes: r.internalNotes,
              chargeAmount: r.chargeAmount == null ? null : num(r.chargeAmount),
              laborCost: r.laborCost == null ? null : num(r.laborCost),
              materialCost: r.materialCost == null ? null : num(r.materialCost),
              materialNote: r.materialNote,
              findings: r.findings.map((f) => ({
                areaId: f.areaId,
                label: f.label,
                category: f.category,
                state: f.state,
                note: f.note,
              })),
              photos: r.photos.map((p) => ({ id: p.id, caption: p.caption, bytes: p.bytes })),
            }}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-[1.4fr_1fr] gap-5">
        <div className="space-y-5">
          {r.summary && (
            <div className="card p-5">
              <SectionHeader title="What the client is told" />
              <p className="text-[14px] leading-[1.7] whitespace-pre-wrap">{r.summary}</p>
            </div>
          )}

          <div className="card p-5">
            <SectionHeader
              title="Walkthrough"
              sub={`${checked} areas checked${issues.length ? `, ${issues.length} flagged` : ", all dry and good"}`}
            />
            {r.findings.length === 0 ? (
              <Empty text="No areas recorded on this visit." />
            ) : (
              <div className="space-y-4">
                {grouped.map(([category, list]) => (
                  <div key={category}>
                    <p className="eyebrow mb-2">{category}</p>
                    <div className="space-y-1">
                      {list.map((f) => (
                        <div key={f.id} className="rounded-xl bg-[var(--surface-2)] px-3 py-2.5">
                          <div className="flex items-start justify-between gap-3">
                            <span className="text-[13px]">{f.label}</span>
                            <span
                              className="shrink-0 text-[12px] font-medium"
                              style={{
                                color:
                                  f.state === "OK"
                                    ? "var(--good)"
                                    : f.state === "ISSUE"
                                      ? "var(--bad)"
                                      : "var(--mut)",
                              }}
                            >
                              {STATE_LABEL[f.state]}
                            </span>
                          </div>
                          {f.note && (
                            <p className="mt-1.5 text-[12.5px] text-[var(--sec)]">{f.note}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <PhotoManager
            photos={r.photos.map((p) => ({ id: p.id, caption: p.caption, bytes: p.bytes }))}
          />
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <SectionHeader title="Money on this visit" sub="These already flow into Jobs and your monthly profit" />

            {v && v.value > 0 && (
              <div className="rounded-xl bg-[var(--surface-2)] p-3.5 mb-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="eyebrow mb-1">What this visit is worth</p>
                    <p className="stat-num text-[22px] leading-none">{money(v.value)}</p>
                  </div>
                  {perHour != null && (
                    <div className="text-right">
                      <p className="eyebrow mb-1">Your rate</p>
                      <p
                        className="stat-num text-[22px] leading-none"
                        style={{
                          color:
                            perHour < 25 ? "var(--bad)" : perHour < 50 ? "var(--warn)" : "var(--good)",
                        }}
                      >
                        {money(perHour)}/hr
                      </p>
                    </div>
                  )}
                </div>
                <p className="text-[12px] text-[var(--mut)] mt-2.5">
                  {v.fromPlan
                    ? `${plan?.planName ? `${plan.planName}, ` : ""}${money(num(plan?.planAmount))} a month split across ${v.planSplit} visit${v.planSplit === 1 ? "" : "s"} this month`
                    : "Charged directly on this visit, not drawn from a plan"}
                  {hours ? ` · ${minutesLabel(r.minutesOnSite)} on site` : " · no time logged yet"}
                  {outOfPocket > 0 ? ` · ${money(outOfPocket)} out of pocket` : ""}
                </p>
              </div>
            )}

            <div className="text-[13px] space-y-1.5">
              <p className="flex justify-between border-b border-[var(--border)] pb-1.5">
                <span className="text-[var(--mut)]">Extra charge</span>
                <span className="tabular-nums font-medium">
                  {r.chargeAmount ? money(num(r.chargeAmount)) : "Covered by plan"}
                </span>
              </p>
              <p className="flex justify-between border-b border-[var(--border)] pb-1.5">
                <span className="text-[var(--mut)]">Paid to a helper</span>
                <span className="tabular-nums font-medium">{money(num(r.laborCost))}</span>
              </p>
              <p className="flex justify-between border-b border-[var(--border)] pb-1.5">
                <span className="text-[var(--mut)]">Materials</span>
                <span className="tabular-nums font-medium">{money(num(r.materialCost))}</span>
              </p>
              {r.materialNote && (
                <p className="text-[12px] text-[var(--mut)]">{r.materialNote}</p>
              )}
              <p className="flex justify-between pt-1">
                <span className="text-[var(--mut)]">Time on site</span>
                <span className="tabular-nums font-medium">
                  {r.minutesOnSite ? `${minutesLabel(r.minutesOnSite)} (${fmtHours(hours)})` : "Not logged"}
                </span>
              </p>
            </div>
            {r.jobId && (
              <Link href="/jobs" className="btn btn-sm mt-4">
                See it on the jobs list
              </Link>
            )}
          </div>

          {r.internalNotes && (
            <div className="card p-5">
              <SectionHeader title="Internal notes" sub="Never printed, never sent" />
              <p className="text-[13.5px] leading-[1.7] whitespace-pre-wrap text-[var(--sec)]">
                {r.internalNotes}
              </p>
            </div>
          )}

          <div className="card p-5">
            <SectionHeader title="Storage" />
            <p className="text-[13px] text-[var(--mut)]">
              {r.photos.length} photos on this report,{" "}
              {fmtBytes(r.photos.reduce((s, p) => s + p.bytes, 0))}.
            </p>
          </div>
        </div>
      </div>
    </Reveal>
  );
}
