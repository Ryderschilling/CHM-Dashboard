import Link from "next/link";
import { prisma } from "@/lib/db";
import { money, num, fmtDate, toInputDate, monthStart } from "@/lib/format";
import { loadFormOptions, photoStorageUsed, fmtBytes, minutesLabel } from "@/lib/visits";
import { ReportVisitButton, VisitReportActions } from "@/components/launchers";
import { SectionHeader, Empty, StatusBadge } from "@/components/ui";
import StatTile from "@/components/StatTile";
import Reveal from "@/components/Reveal";

export const dynamic = "force-dynamic";

/**
 * Visit reports. This is the evidence layer: every walkthrough written up with
 * dated, area-level findings, which is what makes the Annual Coverage Record
 * worth anything in a claim dispute. See [[chm-claim-protection]] before
 * writing any copy here that touches insurance.
 */
export default async function VisitsPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string; client?: string }>;
}) {
  const sp = await searchParams;
  const thisMonth = monthStart(0);

  const [{ clients, properties, areas }, reports, storage] = await Promise.all([
    loadFormOptions(),
    prisma.visitReport.findMany({
      where: sp.client ? { clientId: sp.client } : undefined,
      include: {
        client: { select: { id: true, name: true } },
        property: { select: { address: true } },
        findings: { select: { state: true, label: true, note: true, category: true, areaId: true }, orderBy: { sortOrder: "asc" } },
        photos: { select: { id: true } },
      },
      orderBy: { visitDate: "desc" },
      take: 120,
    }),
    photoStorageUsed(),
  ]);

  const mtd = reports.filter((r) => r.visitDate >= thisMonth);
  const minutesMTD = mtd.reduce((s, r) => s + (r.minutesOnSite ?? 0), 0);
  const drafts = reports.filter((r) => r.status === "DRAFT");
  const openIssues = reports.filter((r) => r.findings.some((f) => f.state === "ISSUE"));

  const filterName = sp.client ? clients.find((c) => c.id === sp.client)?.name : null;

  return (
    <Reveal className="in">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow mb-1.5">Every walkthrough, dated and documented</p>
          <h1 className="display font-semibold text-[28px] leading-none tracking-tight" style={{ fontStretch: "118%" }}>
            Visits
          </h1>
        </div>
        <ReportVisitButton
          clients={clients}
          properties={properties}
          areas={areas}
          autoOpen={sp.new === "1"}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile label="Visits this month" value={mtd.length} accent sub={`${reports.length} on record`} />
        <StatTile label="Time on site this month" value={minutesMTD / 60} sub="Hours, from the reports" />
        <StatTile
          label="Reports with a flag"
          value={openIssues.length}
          sub={openIssues.length ? "Something was marked needs attention" : "Nothing flagged"}
          subTone={openIssues.length ? "warn" : "mut"}
        />
        <StatTile
          label="Photos stored"
          value={storage.count}
          sub={`${fmtBytes(storage.bytes)} used`}
        />
      </div>

      {drafts.length > 0 && (
        <div className="card p-5 mb-5" style={{ borderColor: "rgba(224,166,62,0.35)" }}>
          <SectionHeader
            title="Unfinished drafts"
            sub="A draft is left out of the annual record. Finalize it or it does not count."
          />
          <div className="space-y-1">
            {drafts.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--border)] last:border-0">
                <Link href={`/visits/${r.id}`} className="min-w-0 hover:text-[var(--teal)] transition-colors">
                  <p className="text-[13.5px] font-medium truncate">{r.client.name}</p>
                  <p className="text-[12px] text-[var(--mut)]">{fmtDate(r.visitDate)}</p>
                </Link>
                <StatusBadge status="DRAFT" />
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-5">
        <SectionHeader
          title={filterName ? `Visits for ${filterName}` : "All visit reports"}
          sub="Newest first. Open one to see the full walkthrough and photos."
          action={
            filterName ? (
              <Link href="/visits" className="btn btn-sm">Show everyone</Link>
            ) : undefined
          }
        />

        {reports.length === 0 ? (
          <Empty text="No visit reports yet. Report your first walkthrough and the annual record builds itself from here." />
        ) : (
          <div className="space-y-1">
            {reports.map((r) => {
              const issues = r.findings.filter((f) => f.state === "ISSUE");
              const checked = r.findings.filter((f) => f.state !== "NA").length;
              return (
                <div key={r.id} className="flex flex-wrap items-start justify-between gap-3 py-3 border-b border-[var(--border)] last:border-0">
                  <Link href={`/visits/${r.id}`} className="min-w-0 flex-1 group">
                    <p className="text-[13.5px] font-medium group-hover:text-[var(--teal)] transition-colors">
                      {r.client.name}
                      {r.status === "DRAFT" && (
                        <span className="ml-2 text-[11.5px] text-[var(--warn)]">draft</span>
                      )}
                    </p>
                    <p className="text-[12px] text-[var(--mut)]">
                      {fmtDate(r.visitDate)}
                      {r.property?.address ? ` · ${r.property.address}` : ""}
                      {r.minutesOnSite ? ` · ${minutesLabel(r.minutesOnSite)}` : ""}
                      {` · ${checked} areas checked`}
                      {r.photos.length ? ` · ${r.photos.length} photos` : ""}
                    </p>
                    {issues.length > 0 ? (
                      <p className="mt-1 text-[12px] text-[var(--warn)]">
                        {issues.map((f) => f.label).join(", ")}
                      </p>
                    ) : (
                      <p className="mt-1 text-[12px] text-[var(--good)]">All areas dry and good</p>
                    )}
                  </Link>
                  <div className="flex items-center gap-2 shrink-0">
                    {r.chargeAmount && (
                      <span className="text-[13px] tabular-nums text-[var(--sec)]">
                        {money(num(r.chargeAmount))}
                      </span>
                    )}
                    <Link href={`/print/visit/${r.id}`} target="_blank" className="btn btn-sm">
                      PDF
                    </Link>
                    <VisitReportActions
                      clients={clients}
                      properties={properties}
                      areas={areas}
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
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Reveal>
  );
}
