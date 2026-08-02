import Link from "next/link";
import { notFound } from "next/navigation";
import { getReport, loadFormOptions, minutesLabel, fmtBytes } from "@/lib/visits";
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
                  {r.minutesOnSite ? minutesLabel(r.minutesOnSite) : "Not logged"}
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
