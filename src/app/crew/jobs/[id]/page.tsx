import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCrewWorker } from "@/lib/crew";
import { fmtDate, fmtTime } from "@/lib/format";
import { StatusBadge } from "@/components/ui";
import Reveal from "@/components/Reveal";
import { CrewChecklist, CrewDoneButton, CrewNoteForm } from "@/components/CrewJobTools";
import CrewVisitReportForm from "@/components/forms/CrewVisitReportForm";

export const dynamic = "force-dynamic";

function Code({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-xl bg-[var(--surface-2)] p-3">
      <p className="text-[11px] text-[var(--mut)] mb-1">{label}</p>
      <p className="font-mono text-[16px] font-semibold tracking-wide">{value}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <p className="flex justify-between gap-4 text-[13px]">
      <span className="text-[var(--mut)] shrink-0">{label}</span>
      <span className="text-right">{value}</span>
    </p>
  );
}

export default async function CrewJobPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const worker = await getCrewWorker();
  const { id } = await params;

  // Scoped to this worker: someone else's job id 404s, it does not leak.
  const job = await prisma.job.findFirst({
    where: { id, workerId: worker.id },
    include: {
      client: { select: { name: true } },
      property: true,
      tasks: { select: { id: true, title: true, done: true }, orderBy: { createdAt: "asc" } },
      visitReport: { select: { id: true, status: true, createdAt: true } },
    },
  });
  if (!job) notFound();

  // The house's own walkthrough list, for the end-of-visit report.
  const areas = job.propertyId
    ? await prisma.propertyCheckArea.findMany({
        where: { propertyId: job.propertyId, active: true },
        select: { id: true, label: true, category: true, sortOrder: true },
        orderBy: { sortOrder: "asc" },
      })
    : [];

  const p = job.property;
  const address = p?.address ?? job.location;
  const mapsUrl = address
    ? `https://maps.apple.com/?q=${encodeURIComponent(address)}`
    : null;

  return (
    <Reveal className="in">
      <Link href="/crew" className="text-[13px] text-[var(--mut)] hover:text-[var(--teal)] transition-colors inline-flex items-center gap-1 mb-4">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to schedule
      </Link>

      <div className="mb-5">
        <div className="flex items-center gap-2.5 flex-wrap mb-1.5">
          <h1 className="display font-semibold text-[24px] leading-tight tracking-tight" style={{ fontStretch: "118%" }}>
            {job.title}
          </h1>
          <StatusBadge status={job.status} />
        </div>
        <p className="text-[13.5px] text-[var(--mut)]">
          {fmtDate(job.date)}
          {job.allDay ? " · All day" : ` · ${fmtTime(job.date)}`}
          {job.endDate && !job.allDay ? ` – ${fmtTime(job.endDate)}` : ""}
          {job.client ? ` · ${job.client.name}` : ""}
        </p>
      </div>

      <div className="space-y-4">
        {/* Where */}
        {(address || p) && (
          <div className="card p-4">
            <p className="eyebrow mb-2">The house</p>
            {address && (
              <div className="flex items-start justify-between gap-3 mb-3">
                <p className="text-[14.5px] font-medium">{address}</p>
                {mapsUrl && (
                  <a href={mapsUrl} target="_blank" rel="noreferrer" className="btn btn-sm shrink-0">
                    Directions
                  </a>
                )}
              </div>
            )}
            {p && (p.gateCode || p.doorCode || p.alarmCode) && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                <Code label="Gate" value={p.gateCode} />
                <Code label="Door" value={p.doorCode} />
                <Code label="Alarm" value={p.alarmCode} />
              </div>
            )}
            {p && (
              <div className="space-y-1.5">
                <InfoRow label="Key" value={p.keyLocation} />
                <InfoRow label="Wifi" value={p.wifiName ? `${p.wifiName}${p.wifiPassword ? ` · ${p.wifiPassword}` : ""}` : null} />
                <InfoRow label="Trash day" value={p.trashDay} />
                <InfoRow label="HVAC" value={p.hvacNotes} />
                <InfoRow label="House notes" value={p.notes} />
              </div>
            )}
          </div>
        )}

        {/* What to do */}
        <div className="card p-4">
          <p className="eyebrow mb-2">The work</p>
          {job.jobType && <p className="text-[13px] text-[var(--mut)] mb-2">{job.jobType}</p>}
          {job.notes && (
            <p className="text-[13.5px] whitespace-pre-wrap mb-3 border-b border-[var(--border)] pb-3">
              {job.notes}
            </p>
          )}
          <CrewChecklist tasks={job.tasks} />
        </div>

        {/* End of visit report */}
        <div className="card p-4">
          <p className="eyebrow mb-1">End of visit report</p>
          {job.visitReport ? (
            <div className="flex items-center gap-2.5 py-2">
              <StatusBadge status={job.visitReport.status === "DRAFT" ? "DRAFTED" : "DONE"} />
              <p className="text-[13.5px] text-[var(--sec)]">
                {job.visitReport.status === "DRAFT"
                  ? "Report filed. Ryder will review it before it goes to the client."
                  : "Report finalized."}
              </p>
            </div>
          ) : job.clientId ? (
            <>
              <p className="text-[12.5px] text-[var(--mut)] mb-4">
                Fill this out before you leave the property. Photos of anything flagged.
              </p>
              <CrewVisitReportForm jobId={job.id} areas={areas} />
            </>
          ) : (
            <p className="text-[13px] text-[var(--mut)] py-2">
              No client is linked to this job, so there is no report to file. Use a note instead.
            </p>
          )}
        </div>

        {/* Wrap up */}
        <div className="card p-4 space-y-4">
          <CrewDoneButton jobId={job.id} done={job.status === "DONE"} />
          <CrewNoteForm jobId={job.id} />
        </div>
      </div>
    </Reveal>
  );
}
