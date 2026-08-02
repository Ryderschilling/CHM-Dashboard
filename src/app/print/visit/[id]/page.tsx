import { notFound } from "next/navigation";
import { getReport, minutesLabel } from "@/lib/visits";
import { fmtDate } from "@/lib/format";
import { categoryRank, STATE_LABEL } from "@/lib/checkAreas";
import { CHM, LEGAL_DISCLAIMER } from "@/lib/brand";
import Letterhead from "@/components/print/Letterhead";
import { PrintBar } from "@/components/print/Chrome";

export const dynamic = "force-dynamic";

/** Single visit report, branded, print to PDF. */
export default async function VisitPrint({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = await getReport(id);
  if (!r) notFound();

  const grouped = [...new Set(r.findings.map((f) => f.category))]
    .sort((a, b) => categoryRank(a) - categoryRank(b))
    .map((c) => [c, r.findings.filter((f) => f.category === c)] as const);

  const issues = r.findings.filter((f) => f.state === "ISSUE");
  const checked = r.findings.filter((f) => f.state !== "NA").length;

  return (
    <>
      <PrintBar back={`/visits/${r.id}`} hint="Cmd+P, then choose Save as PDF. Set margins to Default." />

      <div className="sheet">
        <Letterhead docType="Visit Report" />

        <p className="eyebrow-p" style={{ marginTop: 28 }}>
          {r.status === "DRAFT" ? "Draft, not final" : "Property visit record"}
        </p>
        <h1 className="doc-title doc-title--sm">{r.client.name}</h1>
        <p className="lede">
          {r.property?.address ?? "Property address not on file"}
        </p>
        <div className="rule" />

        <dl className="meta">
          <div>
            <dt>Visit date</dt>
            <dd>{fmtDate(r.visitDate)}</dd>
          </div>
          <div>
            <dt>Time on site</dt>
            <dd>{r.minutesOnSite ? minutesLabel(r.minutesOnSite) : "Not recorded"}</dd>
          </div>
          <div>
            <dt>Areas checked</dt>
            <dd>{checked}</dd>
          </div>
          <div>
            <dt>Needing attention</dt>
            <dd style={issues.length ? { color: "#b4272c" } : undefined}>{issues.length}</dd>
          </div>
        </dl>

        {r.weather && (
          <p style={{ fontSize: 11.5, color: "var(--p-muted)", marginTop: 10 }}>
            Conditions: {r.weather}
          </p>
        )}

        {r.summary && (
          <>
            <h2 className="h2">Summary</h2>
            <div className="note">{r.summary}</div>
          </>
        )}

        <h2 className="h2">Walkthrough</h2>
        <p style={{ fontSize: 11.5, color: "var(--p-muted)", margin: "0 0 14px" }}>
          Each area below was checked in person on {fmtDate(r.visitDate)}. Areas recorded as dry
          and good were observed to be dry and free of visible damage on that date.
        </p>

        {grouped.map(([category, list]) => (
          <div key={category} style={{ breakInside: "avoid" }}>
            <h3 className="h3">{category}</h3>
            <table className="findings">
              <tbody>
                {list.map((f) => (
                  <tr key={f.id}>
                    <td>
                      {f.label}
                      {f.note && <span className="finding-note">{f.note}</span>}
                    </td>
                    <td
                      className={`state ${f.state === "OK" ? "state-ok" : f.state === "ISSUE" ? "state-issue" : "state-na"}`}
                    >
                      {STATE_LABEL[f.state]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {r.photos.length > 0 && (
          <>
            <h2 className="h2">Photographs</h2>
            <div className="shots">
              {r.photos.map((p) => (
                <figure key={p.id} className="shot" style={{ margin: 0 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={`/api/photo/${p.id}`} alt={p.caption ?? ""} />
                  <figcaption>{p.caption ?? fmtDate(r.visitDate)}</figcaption>
                </figure>
              ))}
            </div>
          </>
        )}

        <div className="signature">
          <div>
            <div className="sig-name">{CHM.owner}</div>
            <div className="sig-role">{CHM.ownerRole}</div>
          </div>
          <div style={{ fontSize: 10.5, color: "var(--p-muted)", textAlign: "right" }}>
            Record created {fmtDate(r.createdAt)}
            <br />
            Reference {r.id.slice(-8).toUpperCase()}
          </div>
        </div>

        <p className="disclaimer">{LEGAL_DISCLAIMER}</p>
      </div>
    </>
  );
}
