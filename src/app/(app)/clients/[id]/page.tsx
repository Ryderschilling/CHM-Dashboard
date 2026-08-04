import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { money, num, fmtDate, toInputDate, isOverdue } from "@/lib/format";
import {
  EditClientButton,
  DeleteClientButton,
  AddPaymentButton,
  PaymentActions,
  AddJobButton,
  JobActions,
  AddTaskButton,
} from "@/components/launchers";
import { PropertyCard, AddPropertyButton } from "@/components/PropertyCard";
import InvoiceCosts from "@/components/InvoiceCosts";
import { TaskToggle, TaskDelete, NoteComposer, NoteDelete } from "@/components/TaskBits";
import { SectionHeader, StatusBadge, Empty, CADENCE_LABEL, CATEGORY_LABEL } from "@/components/ui";
import StatTile from "@/components/StatTile";
import { valueJobs } from "@/lib/jobValue";
import { fmtDur } from "@/lib/duration";
import Reveal from "@/components/Reveal";
import { IconChevronL } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function ClientDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [client, allClients, workers] = await Promise.all([
    prisma.client.findUnique({
      where: { id },
      include: {
        properties: { orderBy: { createdAt: "asc" }, include: { checkAreas: { orderBy: { sortOrder: "asc" } } } },
        payments: { include: { expenses: true }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 40 },
        jobs: { include: { worker: true }, orderBy: { date: "desc" }, take: 30 },
        tasks: { orderBy: [{ done: "asc" }, { createdAt: "desc" }], take: 20 },
        logs: { orderBy: { createdAt: "desc" }, take: 25 },
        shutoffDevices: { include: { alerts: { orderBy: { occurredAt: "desc" }, take: 3 } } },
        visitReports: {
          include: { findings: { select: { state: true, label: true } }, photos: { select: { id: true } } },
          orderBy: { visitDate: "desc" },
          take: 12,
        },
        coverageRecords: { orderBy: { dueDate: "desc" } },
      },
    }),
    prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.worker.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  if (!client) notFound();

  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const paid = client.payments.filter((p) => p.status === "PAID");
  const due = client.payments.filter((p) => p.status === "DUE");
  const upcoming = client.payments.filter((p) => p.status === "UPCOMING");
  const lifetime = paid.reduce((s, p) => s + num(p.amount), 0);
  const ytd = paid.filter((p) => p.paidDate && p.paidDate >= yearStart).reduce((s, p) => s + num(p.amount), 0);
  const owed = due.reduce((s, p) => s + num(p.amount), 0);
  const upcomingSum = upcoming.reduce((s, p) => s + num(p.amount), 0);
  const laborYtd = client.jobs
    .filter((j) => j.status === "DONE" && j.date >= yearStart)
    .reduce((s, j) => s + num(j.laborCost), 0);
  const costsYtdAgg = await prisma.expense.aggregate({
    where: { clientId: client.id, date: { gte: yearStart } },
    _sum: { amount: true },
  });
  const costsYtd = num(costsYtdAgg._sum.amount);

  // Per-visit value needs the client's plan, which lives on the client record here.
  const jobValues = valueJobs(
    client.jobs.map((j) => ({
      id: j.id,
      clientId: client.id,
      date: j.date,
      chargeAmount: j.chargeAmount,
      laborCost: j.laborCost,
      laborMinutes: j.laborMinutes,
      client: { cadence: client.cadence, planAmount: client.planAmount },
    }))
  );

  const clientDefaults = {
    id: client.id,
    name: client.name,
    status: client.status,
    email: client.email,
    phone: client.phone,
    altContact: client.altContact,
    community: client.community,
    planName: client.planName,
    planAmount: client.planAmount == null ? null : num(client.planAmount),
    cadence: client.cadence,
    lockedRate: client.lockedRate,
    lockedUntil: toInputDate(client.lockedUntil),
    startDate: toInputDate(client.startDate),
    source: client.source,
    notes: client.notes,
  };

  const propertyOpts = client.properties.map((p) => ({ id: p.id, clientId: client.id, address: p.address }));

  return (
    <Reveal className="in">
      <Link href="/clients" className="inline-flex items-center gap-1 text-[13px] text-[var(--mut)] hover:text-[var(--ink)] transition-colors mb-4">
        <IconChevronL size={14} /> All clients
      </Link>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="display font-semibold text-[28px] leading-none tracking-tight" style={{ fontStretch: "118%" }}>
              {client.name}
            </h1>
            <StatusBadge status={client.status} />
            {client.lockedRate && <span className="badge badge-teal">Locked rate</span>}
          </div>
          <p className="text-[13px] text-[var(--mut)] mt-2">
            {[
              client.planName && client.planAmount
                ? `${client.planName} · ${money(client.planAmount)} ${CADENCE_LABEL[client.cadence]?.toLowerCase()}`
                : client.planName,
              client.community,
              client.startDate ? `since ${fmtDate(client.startDate)}` : null,
            ]
              .filter(Boolean)
              .join("  ·  ")}
          </p>
        </div>
        <div className="flex gap-2">
          <EditClientButton defaults={clientDefaults} />
          <DeleteClientButton id={client.id} />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatTile label="Lifetime collected" value={lifetime} money accent />
        <StatTile label={`Collected ${new Date().getFullYear()}`} value={ytd} money />
        <StatTile
          label="Owes you now"
          value={owed}
          money
          sub={
            due.some((p) => isOverdue(p.dueDate))
              ? "Has overdue items"
              : upcomingSum > 0
                ? `${money(upcomingSum)} scheduled soon`
                : undefined
          }
          subTone={due.some((p) => isOverdue(p.dueDate)) ? "bad" : "mut"}
        />
        <StatTile
          label="Profit this year"
          value={ytd - laborYtd - costsYtd}
          money
          sub="Collected minus labor and job costs"
          subTone={ytd - laborYtd - costsYtd >= 0 ? "good" : "bad"}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* Contact */}
          <div className="card p-5">
            <SectionHeader title="Contact" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13.5px]">
              <div>
                <p className="text-[11.5px] text-[var(--mut)] mb-0.5">Phone</p>
                {client.phone ? <a href={`tel:${client.phone}`} className="hover:text-[var(--teal)]">{client.phone}</a> : <span className="text-[var(--mut)]">Not set</span>}
              </div>
              <div>
                <p className="text-[11.5px] text-[var(--mut)] mb-0.5">Email</p>
                {client.email ? <a href={`mailto:${client.email}`} className="hover:text-[var(--teal)] break-all">{client.email}</a> : <span className="text-[var(--mut)]">Not set</span>}
              </div>
              <div>
                <p className="text-[11.5px] text-[var(--mut)] mb-0.5">Alt contact</p>
                <span className={client.altContact ? "" : "text-[var(--mut)]"}>{client.altContact ?? "Not set"}</span>
              </div>
              <div>
                <p className="text-[11.5px] text-[var(--mut)] mb-0.5">Source</p>
                <span className={client.source ? "" : "text-[var(--mut)]"}>{client.source ?? "Not set"}</span>
              </div>
            </div>
            {client.notes && (
              <p className="text-[13px] text-[var(--sec)] mt-4 pt-3 border-t border-[var(--border)] whitespace-pre-wrap">{client.notes}</p>
            )}
          </div>

          {/* Properties */}
          <div className="card p-5">
            <SectionHeader
              title="Properties and access"
              sub="Tap a code to reveal it"
              action={<AddPropertyButton clientId={client.id} />}
            />
            {client.properties.length ? (
              <div className="space-y-3">
                {client.properties.map((p) => (
                  <PropertyCard
                    key={p.id}
                    clientId={client.id}
                    checkAreas={p.checkAreas}
                    property={{
                      id: p.id,
                      label: p.label,
                      address: p.address,
                      gateCode: p.gateCode,
                      doorCode: p.doorCode,
                      alarmCode: p.alarmCode,
                      wifiName: p.wifiName,
                      wifiPassword: p.wifiPassword,
                      keyLocation: p.keyLocation,
                      trashDay: p.trashDay,
                      hvacNotes: p.hvacNotes,
                      notes: p.notes,
                    }}
                  />
                ))}
              </div>
            ) : (
              <Empty text="No property on file yet." />
            )}
          </div>

          {/* Visit reports. The evidence trail that becomes the annual record. */}
          <div className="card p-5">
            <SectionHeader
              title="Visit reports"
              sub="Dated walkthroughs with area-level findings"
              action={
                <Link href={`/visits?client=${client.id}`} className="btn btn-sm">
                  All visits
                </Link>
              }
            />
            {client.visitReports.length === 0 ? (
              <Empty text="No visit reports yet. Report a walkthrough and it lands here, on the jobs list, and in this year's record." />
            ) : (
              <div className="space-y-1">
                {client.visitReports.map((v) => {
                  const issues = v.findings.filter((f) => f.state === "ISSUE");
                  const checked = v.findings.filter((f) => f.state !== "NA").length;
                  return (
                    <Link
                      key={v.id}
                      href={`/visits/${v.id}`}
                      className="flex items-start justify-between gap-3 py-2 border-b border-[var(--border)] last:border-0 group"
                    >
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-medium group-hover:text-[var(--teal)] transition-colors">
                          {fmtDate(v.visitDate)}
                          {v.status === "DRAFT" && (
                            <span className="ml-2 text-[11.5px] text-[var(--warn)]">draft</span>
                          )}
                        </p>
                        <p className="text-[12px] text-[var(--mut)]">
                          {checked} areas checked
                          {v.photos.length ? ` · ${v.photos.length} photos` : ""}
                          {v.minutesOnSite ? ` · ${v.minutesOnSite} min` : ""}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 text-[12px] ${issues.length ? "text-[var(--warn)]" : "text-[var(--good)]"}`}
                      >
                        {issues.length ? `${issues.length} flagged` : "All clear"}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Protection. Full management lives on /protection. */}
          <div className="card p-5">
            <SectionHeader
              title="Protection"
              sub="Water shutoff and the annual Coverage Record"
              action={
                <Link href="/protection" className="btn btn-sm">
                  Manage
                </Link>
              }
            />
            {client.shutoffDevices.length === 0 && client.coverageRecords.length === 0 ? (
              <Empty text="Not on either protection service yet. Both are an easy add at renewal." />
            ) : (
              <div className="space-y-2.5">
                {client.shutoffDevices.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)] px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium">
                        Water shutoff{d.brand ? ` · ${d.brand}` : ""}
                      </p>
                      <p className="text-[12px] text-[var(--mut)]">
                        {d.installDate ? `Installed ${fmtDate(d.installDate)}` : "Not installed yet"}
                        {d.monitored ? " · monitored by you" : " · not monitored"}
                        {d.alerts.length ? ` · last alert ${fmtDate(d.alerts[0].occurredAt)}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={d.status} />
                  </div>
                ))}
                {client.coverageRecords.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--surface-2)] px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-[13.5px] font-medium">
                        Coverage Record {r.periodStart.getFullYear()}
                      </p>
                      <p className="text-[12px] text-[var(--mut)]">
                        {r.status === "SENT" && r.sentDate
                          ? `Sent ${fmtDate(r.sentDate)}`
                          : `Send by ${fmtDate(r.dueDate)}`}
                        {r.fee ? ` · ${money(r.fee)}/yr` : " · included in plan"}
                      </p>
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Activity log */}
          <div className="card p-5">
            <SectionHeader title="Activity log" sub="Running history for this client" />
            <NoteComposer clientId={client.id} />
            <div className="mt-4 space-y-3">
              {client.logs.map((n) => (
                <div key={n.id} className="flex items-start justify-between gap-3 group">
                  <div>
                    <p className="text-[13px] whitespace-pre-wrap">{n.body}</p>
                    <p className="text-[11.5px] text-[var(--mut)] mt-0.5">{fmtDate(n.createdAt)}</p>
                  </div>
                  <span className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <NoteDelete id={n.id} />
                  </span>
                </div>
              ))}
              {client.logs.length === 0 && <p className="text-[12.5px] text-[var(--mut)] pt-1">Nothing logged yet.</p>}
            </div>
          </div>

          {/* Tasks */}
          <div className="card p-5">
            <SectionHeader
              title="Tasks"
              action={<AddTaskButton clients={allClients} fixedClientId={client.id} primary={false} />}
            />
            {client.tasks.length ? (
              <div className="space-y-2">
                {client.tasks.map((t) => (
                  <div key={t.id} className="flex items-center gap-3 group">
                    <TaskToggle id={t.id} done={t.done} />
                    <span className={`flex-1 text-[13.5px] ${t.done ? "line-through text-[var(--mut)]" : ""}`}>
                      {t.title}
                    </span>
                    {t.dueDate && !t.done && (
                      <span className={`text-[11.5px] ${isOverdue(t.dueDate) ? "text-[var(--bad)]" : "text-[var(--mut)]"}`}>
                        {fmtDate(t.dueDate)}
                      </span>
                    )}
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                      <TaskDelete id={t.id} />
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty text="No tasks tied to this client." />
            )}
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Money */}
          <div className="card p-5">
            <SectionHeader
              title="Money"
              sub={owed > 0 ? `${money(owed)} outstanding` : "Nothing outstanding"}
              action={<AddPaymentButton clients={allClients} fixedClientId={client.id} label="Add" primary={false} />}
            />
            {client.payments.length ? (
              <div className="space-y-1">
                {client.payments.map((p) => {
                  const overdue = p.status === "DUE" && isOverdue(p.dueDate);
                  return (
                    <div key={p.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--border)] last:border-0">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-medium truncate">
                          {p.description ?? CATEGORY_LABEL[p.category]}
                          {p.invoiceNumber ? <span className="text-[var(--mut)] font-normal"> · #{p.invoiceNumber}</span> : null}
                        </p>
                        <p className="text-[12px] text-[var(--mut)]">
                          {p.status === "PAID"
                            ? `Paid ${fmtDate(p.paidDate)}${p.method ? ` · ${p.method.toLowerCase()}` : ""}`
                            : p.status === "UPCOMING"
                              ? p.dueDate ? `Sends ${fmtDate(p.dueDate)}` : "Scheduled"
                              : p.dueDate
                                ? `Due ${fmtDate(p.dueDate)}`
                                : "Due"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0">
                        <span className={`font-semibold tabular-nums text-[14px] ${overdue ? "text-[var(--bad)]" : p.status === "DUE" ? "text-[var(--warn)]" : ""}`}>
                          {money(p.amount)}
                        </span>
                        <StatusBadge status={overdue ? "OVERDUE" : p.status} />
                        <InvoiceCosts
                          payment={{
                            id: p.id,
                            amount: num(p.amount),
                            label: `${p.description ?? CATEGORY_LABEL[p.category]}${p.invoiceNumber ? ` · #${p.invoiceNumber}` : ""}`,
                          }}
                          expenses={p.expenses.map((e) => ({
                            id: e.id,
                            amount: num(e.amount),
                            description: e.description,
                            category: e.category,
                            dateLabel: fmtDate(e.date),
                          }))}
                        />
                        <PaymentActions
                          clients={allClients}
                          payment={{
                            id: p.id,
                            clientId: p.clientId,
                            amount: num(p.amount),
                            status: p.status,
                            dueDate: toInputDate(p.dueDate),
                            paidDate: toInputDate(p.paidDate),
                            method: p.method,
                            category: p.category,
                            description: p.description,
                            invoiceNumber: p.invoiceNumber,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty text="No payments logged yet." />
            )}
          </div>

          {/* Jobs */}
          <div className="card p-5">
            <SectionHeader
              title="Jobs"
              sub="Most recent first"
              action={
                <AddJobButton clients={allClients} workers={workers} properties={propertyOpts} fixedClientId={client.id} primary={false} />
              }
            />
            {client.jobs.length ? (
              <div className="space-y-1">
                {client.jobs.map((j) => {
                  const v = jobValues.get(j.id);
                  return (
                    <div key={j.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--border)] last:border-0">
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-medium truncate">{j.title}</p>
                        <p className="text-[12px] text-[var(--mut)]">
                          {fmtDate(j.date)} · {j.worker?.name ?? "You"}
                          {v?.minutes ? ` · ${fmtDur(v.minutes)}` : ""}
                          {v && v.value > 0 ? ` · ${money(v.value)}${v.fromPlan ? " plan" : ""}` : ""}
                          {v && v.labor > 0 ? ` · paid out ${money(v.labor)} · net ${money(v.profit)}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusBadge status={j.status} />
                        <JobActions
                          clients={allClients}
                          workers={workers}
                          properties={propertyOpts}
                          job={{
                            id: j.id,
                            clientId: j.clientId,
                            propertyId: j.propertyId,
                            title: j.title,
                            jobType: j.jobType,
                            date: toInputDate(j.date),
                            status: j.status,
                            workerId: j.workerId,
                            laborCost: num(j.laborCost),
                            laborMinutes: j.laborMinutes,
                            chargeAmount: j.chargeAmount == null ? null : num(j.chargeAmount),
                            durationMin: j.durationMin,
                            notes: j.notes,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty text="No jobs for this client yet." />
            )}
          </div>

        </div>
      </div>
    </Reveal>
  );
}
