import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getReportsInPeriod, minutesLabel } from "@/lib/visits";
import { fmtDate } from "@/lib/format";
import { categoryRank, STATE_LABEL } from "@/lib/checkAreas";
import { CHM, LEGAL_DISCLAIMER } from "@/lib/brand";
import Letterhead from "@/components/print/Letterhead";
import { PrintBar } from "@/components/print/Chrome";

export const dynamic = "force-dynamic";

/**
 * THE ANNUAL COVERAGE RECORD.
 *
 * Assembled from every FINAL visit report in the period, plus any water
 * shutoff alerts on that client's device. Nothing here is typed by hand.
 *
 * What makes this document worth $195 is the per-area detail, specifically the
 * areas recorded DRY. A carrier arguing a leak ran past 14 days has to
 * apportion damage, and a dated line saying an area was dry on a given day is
 * what makes that hard. That is the entire product. See [[chm-claim-protection]].
 *
 * LANGUAGE: this document never claims to lower a premium, never calls a visit
 * an inspection, and always carries LEGAL_DISCLAIMER. Do not change that.
 */
export default async function CoveragePrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const record = await prisma.coverageRecord.findUnique({
    where: { id },
    include: { client: { select: { id: true, name: true, planName: true } } },
  });
  if (!record) notFound();

  const [reports, properties, devices] = await Promise.all([
    getReportsInPeriod(record.clientId, record.periodStart, record.periodEnd),
    prisma.property.findMany({
      where: { clientId: record.clientId },
      select: { address: true, label: true },
    }),
    prisma.shutoffDevice.findMany({
      where: { clientId: record.clientId },
      include: {
        alerts: {
          where: { occurredAt: { gte: record.periodStart, lte: record.periodEnd } },
          orderBy: { occurredAt: "asc" },
        },
      },
    }),
  ]);

  const totalMinutes = reports.reduce((s, r) => s + (r.minutesOnSite ?? 0), 0);
  const totalPhotos = reports.reduce((s, r) => s + r.photos.length, 0);
  const allFindings = reports.flatMap((r) => r.findings);
  const okCount = allFindings.filter((f) => f.state === "OK").length;
  const flagged = reports.filter((r) => r.findings.some((f) => f.state === "ISSUE"));
  const alerts = devices.flatMap((d) => d.alerts);

  // Coverage by area across the whole period: how many times each area was
  // checked and how many of those it was dry. This table is the single most
  // useful page in the document.
  const byArea = new Map<string, { category: string; checked: number; ok: number; issues: number }>();
  for (const f of allFindings) {
    if (f.state === "NA") continue;
    const row = byArea.get(f.label) ?? { category: f.category, checked: 0, ok: 0, issues: 0 };
    row.checked += 1;
    if (f.state === "OK") row.ok += 1;
    else row.issues += 1;
    byArea.set(f.label, row);
  }
  const areaRows = [...byArea.entries()].sort(
    (a, b) => categoryRank(a[1].category) - categoryRank(b[1].category) || a[0].localeCompare(b[0]),
  );

  const period = `${fmtDate(record.periodStart)} to ${fmtDate(record.periodEnd)}`;

  return (
    <>
      <PrintBar
        back="/protection"
        hint={
          reports.length === 0
            ? "No finalized visit reports in this period yet, so this record is empty."
            : `${reports.length} visits in this period. Cmd+P, then Save as PDF.`
        }
      />

      <div className="sheet">
        <Letterhead docType="Annual Coverage Record" />

        <p className="eyebrow-p" style={{ marginTop: 30 }}>Property care record</p>
        <h1 className="doc-title">{record.client.name}</h1>
        <p className="lede">
          {properties.map((p) => p.address).join(" · ") || "Property address not on file"}
        </p>
        <div className="rule" />

        <p className="lede">
          This document is the complete record of property visits made by Coastal Home
          Management 30A during the period below. Each visit is dated. Each area checked is
          listed with the condition it was found in on that date, including the areas found
          dry and undamaged.
        </p>

        <dl className="meta">
          <div>
            <dt>Period</dt>
            <dd style={{ fontSize: 11.5 }}>{period}</dd>
          </div>
          <div>
            <dt>Visits documented</dt>
            <dd>{reports.length}</dd>
          </div>
          <div>
            <dt>Time on site</dt>
            <dd>{totalMinutes ? minutesLabel(totalMinutes) : "Not recorded"}</dd>
          </div>
          <div>
            <dt>Photographs</dt>
            <dd>{totalPhotos}</dd>
          </div>
        </dl>

        {reports.length === 0 ? (
          <div className="note" style={{ marginTop: 26 }}>
            There are no finalized visit reports in this period. Finalize the visit reports for
            these dates and this record will build itself from them.
          </div>
        ) : (
          <>
            {/* ── Summary ────────────────────────────────────────────── */}
            <h2 className="h2">Summary of the period</h2>
            <div className="note">
              Across {reports.length} documented visits, {allFindings.length} area checks were
              recorded, {okCount} of which were found dry and in good condition on the date
              noted.{" "}
              {flagged.length === 0
                ? "No area was found needing attention at any point during this period."
                : `${flagged.length} ${flagged.length === 1 ? "visit" : "visits"} recorded at least one area needing attention. Each is detailed below with the date it was found and the action taken.`}
              {alerts.length > 0 &&
                ` The automatic water shutoff device on this property reported ${alerts.length} ${alerts.length === 1 ? "event" : "events"} during the period, listed at the end of this record.`}
            </div>

            {/* ── Coverage by area ───────────────────────────────────── */}
            <h2 className="h2">Coverage by area</h2>
            <p style={{ fontSize: 11.5, color: "var(--p-muted)", margin: "0 0 12px" }}>
              How many times each area was checked during the period, and how many of those
              checks found it dry and in good condition.
            </p>
            <table className="findings">
              <tbody>
                {areaRows.map(([label, row]) => (
                  <tr key={label}>
                    <td>
                      {label}
                      <span className="finding-note">{row.category}</span>
                    </td>
                    <td className={`state ${row.issues ? "state-issue" : "state-ok"}`}>
                      {row.ok} of {row.checked} dry
                      {row.issues > 0 && `, ${row.issues} flagged`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* ── Visit log ──────────────────────────────────────────── */}
            <div className="page-break" />
            <h2 className="h2">Visit log</h2>
            <p style={{ fontSize: 11.5, color: "var(--p-muted)", margin: "0 0 12px" }}>
              Every visit in the period, in order.
            </p>

            {reports.map((r) => {
              const issues = r.findings.filter((f) => f.state === "ISSUE");
              const checked = r.findings.filter((f) => f.state !== "NA").length;
              return (
                <div key={r.id} className="visit">
                  <div className="visit-head">
                    <span className="visit-date">{fmtDate(r.visitDate)}</span>
                    <span className="visit-meta">
                      {checked} areas checked
                      {r.minutesOnSite ? ` · ${minutesLabel(r.minutesOnSite)} on site` : ""}
                      {r.photos.length ? ` · ${r.photos.length} photos` : ""}
                    </span>
                  </div>

                  {r.summary && <p className="visit-line">{r.summary}</p>}

                  {issues.length === 0 ? (
                    <p className="visit-line visit-clear">
                      All {checked} areas found dry and in good condition.
                    </p>
                  ) : (
                    <table className="findings" style={{ marginTop: 7 }}>
                      <tbody>
                        {issues.map((f) => (
                          <tr key={f.id}>
                            <td>
                              {f.label}
                              {f.note && <span className="finding-note">{f.note}</span>}
                            </td>
                            <td className="state state-issue">{STATE_LABEL[f.state]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {r.weather && <p className="visit-line">Conditions: {r.weather}</p>}
                </div>
              );
            })}

            {/* ── Photographs ────────────────────────────────────────── */}
            {totalPhotos > 0 && (
              <>
                <div className="page-break" />
                <h2 className="h2">Photographs</h2>
                <p style={{ fontSize: 11.5, color: "var(--p-muted)", margin: "0 0 12px" }}>
                  Photographs taken during the visits above, grouped by visit date.
                </p>
                {reports
                  .filter((r) => r.photos.length > 0)
                  .map((r) => (
                    <div key={r.id} style={{ breakInside: "avoid", marginBottom: 16 }}>
                      <h3 className="h3">{fmtDate(r.visitDate)}</h3>
                      <div className="shots">
                        {r.photos.map((p) => (
                          <figure key={p.id} className="shot" style={{ margin: 0 }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/api/photo/${p.id}`} alt={p.caption ?? ""} />
                            <figcaption>{p.caption ?? fmtDate(r.visitDate)}</figcaption>
                          </figure>
                        ))}
                      </div>
                    </div>
                  ))}
              </>
            )}
          </>
        )}

        {/* ── Shutoff device ───────────────────────────────────────── */}
        {devices.length > 0 && (
          <>
            <h2 className="h2">Automatic water shutoff</h2>
            {devices.map((d) => (
              <div key={d.id} style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 12, margin: "0 0 6px" }}>
                  {d.brand ?? "Shutoff device"}
                  {d.installDate ? `, installed ${fmtDate(d.installDate)}` : ""}
                  {d.monitored ? ", monitored by Coastal Home Management 30A" : ""}
                  {d.serialNumber ? `. Serial ${d.serialNumber}` : ""}
                </p>
                {d.alerts.length === 0 ? (
                  <p style={{ fontSize: 11.5, color: "var(--p-muted)", margin: 0 }}>
                    No events reported during this period.
                  </p>
                ) : (
                  <table className="findings">
                    <tbody>
                      {d.alerts.map((a) => (
                        <tr key={a.id}>
                          <td>
                            {fmtDate(a.occurredAt)}, {a.summary}
                            {a.action && <span className="finding-note">Action taken: {a.action}</span>}
                          </td>
                          <td className={`state ${a.resolvedAt ? "state-ok" : "state-issue"}`}>
                            {a.resolvedAt ? `Resolved ${fmtDate(a.resolvedAt)}` : "Open"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </>
        )}

        <div className="signature">
          <div>
            <div className="sig-name">{CHM.owner}</div>
            <div className="sig-role">{CHM.ownerRole}</div>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--p-muted)", textAlign: "right" }}>
            Record compiled {fmtDate(new Date())}
            <br />
            Reference {record.id.slice(-8).toUpperCase()}
          </div>
        </div>

        <p className="disclaimer">{LEGAL_DISCLAIMER}</p>
      </div>
    </>
  );
}
