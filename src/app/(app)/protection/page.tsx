import Link from "next/link";
import { prisma } from "@/lib/db";
import { money, num, fmtDate, toInputDate, daysUntil, isOverdue } from "@/lib/format";
import {
  AddShutoffButton,
  ShutoffActions,
  AddAlertButton,
  AlertActions,
  AddCoverageButton,
  CoverageActions,
} from "@/components/launchers";
import { SectionHeader, Empty, StatusBadge, ALERT_KIND_LABEL } from "@/components/ui";
import StatTile from "@/components/StatTile";
import Reveal from "@/components/Reveal";

export const dynamic = "force-dynamic";

/**
 * Protection = the two claim-protection services.
 *
 *   Water Shutoff Protection  $1,295 installed + $35/mo monitored
 *   Annual Coverage Record    $195/yr, included on Coastal Elite
 *
 * LANGUAGE RULE, do not break it: neither of these lowers anyone's insurance
 * premium and we never say they do. The shutoff DEVICE may earn a credit from
 * the client's own carrier, which is the carrier's doing, not ours. The full
 * rule lives in the public site at src/data/protection.ts. Copy that ships to
 * a client has to match it.
 */

const YEAR_MS = 365 * 86_400_000;

export default function ProtectionPage(props: {
  searchParams: Promise<{ new?: string }>;
}) {
  return <Body searchParams={props.searchParams} />;
}

async function Body({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const sp = await searchParams;

  const [clients, properties, devices, alerts, records] = await Promise.all([
    prisma.client.findMany({
      where: { status: { in: ["ACTIVE", "LEAD", "PAUSED"] } },
      select: { id: true, name: true, status: true, planName: true },
      orderBy: { name: "asc" },
    }),
    prisma.property.findMany({ select: { id: true, clientId: true, address: true } }),
    prisma.shutoffDevice.findMany({
      include: {
        client: { select: { id: true, name: true } },
        property: { select: { address: true } },
        alerts: { orderBy: { occurredAt: "desc" }, take: 1 },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    prisma.shutoffAlert.findMany({
      include: {
        device: {
          select: {
            id: true,
            brand: true,
            client: { select: { id: true, name: true } },
            property: { select: { address: true } },
          },
        },
      },
      orderBy: [{ occurredAt: "desc" }],
      take: 40,
    }),
    prisma.coverageRecord.findMany({
      include: { client: { select: { id: true, name: true } } },
      orderBy: [{ dueDate: "asc" }],
    }),
  ]);

  const clientOpts = clients.map((c) => ({ id: c.id, name: c.name }));
  const deviceOpts = devices.map((d) => ({
    id: d.id,
    label: `${d.client.name}${d.brand ? ` · ${d.brand}` : ""}`,
  }));

  /* ── Numbers ────────────────────────────────────────────────────────── */

  const installed = devices.filter((d) => d.status === "INSTALLED");
  const monitored = installed.filter((d) => d.monitored);
  const monitoringMRR = monitored.reduce((s, d) => s + num(d.monitoringFee), 0);
  const installMargin = devices.reduce(
    (s, d) => s + (num(d.installPrice) - num(d.installCost)),
    0,
  );
  const openAlerts = alerts.filter((a) => a.resolvedAt == null);

  const sentRecords = records.filter((r) => r.status === "SENT");
  const openRecords = records.filter((r) => r.status !== "SENT");
  const recordsOverdue = openRecords.filter((r) => isOverdue(r.dueDate));
  const recordsSoon = openRecords.filter(
    (r) => !isOverdue(r.dueDate) && daysUntil(r.dueDate) <= 45,
  );
  const coverageAnnual = records
    .filter((r) => r.status !== "SENT" || Date.now() - r.periodEnd.getTime() < YEAR_MS)
    .reduce((s, r) => s + num(r.fee), 0);

  // The upsell list: active clients on neither service yet.
  const withDevice = new Set(devices.map((d) => d.clientId));
  const withRecord = new Set(records.map((r) => r.clientId));
  const unprotected = clients.filter(
    (c) => c.status === "ACTIVE" && !withDevice.has(c.id) && !withRecord.has(c.id),
  );

  const staleCheck = installed.filter(
    (d) => d.lastCheckedAt == null || Date.now() - d.lastCheckedAt.getTime() > 90 * 86_400_000,
  );

  return (
    <Reveal className="in">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow mb-1.5">Water shutoff devices and the annual record</p>
          <h1
            className="display font-semibold text-[28px] leading-none tracking-tight"
            style={{ fontStretch: "118%" }}
          >
            Protection
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <AddAlertButton devices={deviceOpts} />
          <AddCoverageButton clients={clientOpts} label="Enroll in record" primary={false} />
          <AddShutoffButton
            clients={clientOpts}
            properties={properties}
            autoOpen={sp.new === "1"}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile
          label="Homes with a shutoff"
          value={installed.length}
          accent
          sub={`${monitored.length} monitored by you`}
        />
        <StatTile
          label="Monitoring per month"
          value={monitoringMRR}
          money
          sub={monitored.length ? `${monitored.length} devices` : "No monitored devices yet"}
        />
        <StatTile
          label="Install margin all time"
          value={installMargin}
          money
          sub="Client paid minus your cost"
        />
        <StatTile
          label="Records to send"
          value={openRecords.length}
          sub={
            recordsOverdue.length
              ? `${recordsOverdue.length} past due`
              : recordsSoon.length
                ? `${recordsSoon.length} due within 45 days`
                : "Nothing due soon"
          }
          subTone={recordsOverdue.length ? "bad" : recordsSoon.length ? "warn" : "mut"}
        />
      </div>

      {/* ── Needs attention ─────────────────────────────────────────────── */}
      {(openAlerts.length > 0 || recordsOverdue.length > 0 || staleCheck.length > 0) && (
        <div className="card p-5 mb-5" style={{ borderColor: "rgba(224,166,62,0.35)" }}>
          <SectionHeader title="Needs attention" sub="Open alerts, overdue records, devices you have not checked in a while" />
          <div className="space-y-1">
            {openAlerts.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--border)] last:border-0">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium truncate">
                    {a.device.client.name} · {ALERT_KIND_LABEL[a.kind] ?? a.kind}
                  </p>
                  <p className="text-[12px] text-[var(--mut)] truncate">
                    {fmtDate(a.occurredAt)} · {a.summary}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={a.severity} />
                  <AlertActions
                    devices={deviceOpts}
                    alert={{
                      id: a.id,
                      deviceId: a.deviceId,
                      occurredAt: toInputDate(a.occurredAt),
                      kind: a.kind,
                      severity: a.severity,
                      summary: a.summary,
                      action: a.action,
                      resolvedAt: toInputDate(a.resolvedAt),
                      notes: a.notes,
                      resolved: false,
                    }}
                  />
                </div>
              </div>
            ))}

            {recordsOverdue.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--border)] last:border-0">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium truncate">{r.client.name} · Coverage Record</p>
                  <p className="text-[12px] text-[var(--bad)]">
                    Was due {fmtDate(r.dueDate)}
                  </p>
                </div>
                <CoverageActions clients={clientOpts} record={coverageDefaults(r)} />
              </div>
            ))}

            {staleCheck.map((d) => (
              <div key={d.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--border)] last:border-0">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium truncate">{d.client.name} · device health</p>
                  <p className="text-[12px] text-[var(--mut)]">
                    {d.lastCheckedAt ? `Last checked ${fmtDate(d.lastCheckedAt)}` : "Never checked"}
                  </p>
                </div>
                <ShutoffActions
                  clients={clientOpts}
                  properties={properties}
                  devices={deviceOpts}
                  device={deviceDefaults(d)}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Devices ─────────────────────────────────────────────────────── */}
      <div className="card p-5 mb-5">
        <SectionHeader
          title="Water Shutoff Protection"
          sub="$1,295 installed, $35 a month to monitor. Monitoring is included on Coastal Elite."
          action={
            <AddShutoffButton clients={clientOpts} properties={properties} label="Add device" primary={false} />
          }
        />
        {devices.length === 0 ? (
          <Empty text="No devices yet. Add the first one when a client says yes." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[var(--mut)] text-left">
                  <th className="font-medium pb-2 pr-3">Client</th>
                  <th className="font-medium pb-2 pr-3">Device</th>
                  <th className="font-medium pb-2 pr-3">Installed</th>
                  <th className="font-medium pb-2 pr-3">Monitoring</th>
                  <th className="font-medium pb-2 pr-3">Last alert</th>
                  <th className="font-medium pb-2 pr-3">Checked</th>
                  <th className="font-medium pb-2" />
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => {
                  const last = d.alerts[0];
                  return (
                    <tr key={d.id} className="border-t border-[var(--border)]">
                      <td className="py-2.5 pr-3">
                        <Link href={`/clients/${d.clientId}`} className="font-medium hover:text-[var(--teal)] transition-colors">
                          {d.client.name}
                        </Link>
                        {d.property?.address && (
                          <p className="text-[11.5px] text-[var(--mut)]">{d.property.address}</p>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className="text-[var(--sec)]">{d.brand ?? "Not set"}</span>
                        {d.serialNumber && (
                          <p className="text-[11.5px] text-[var(--mut)]">SN {d.serialNumber}</p>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge status={d.status} />
                        {d.installDate && (
                          <p className="text-[11.5px] text-[var(--mut)] mt-1">{fmtDate(d.installDate)}</p>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums">
                        {d.monitored ? (
                          <span className="text-[var(--good)]">
                            {d.monitoringFee ? `${money(d.monitoringFee)}/mo` : "Included"}
                          </span>
                        ) : (
                          <span className="text-[var(--mut)]">Not monitored</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-[var(--mut)]">
                        {last ? `${fmtDate(last.occurredAt)} · ${ALERT_KIND_LABEL[last.kind] ?? last.kind}` : "None"}
                      </td>
                      <td className="py-2.5 pr-3 text-[var(--mut)]">
                        {d.lastCheckedAt ? fmtDate(d.lastCheckedAt) : "Never"}
                      </td>
                      <td className="py-2.5 text-right">
                        <ShutoffActions
                          clients={clientOpts}
                          properties={properties}
                          devices={deviceOpts}
                          device={deviceDefaults(d)}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Coverage records ────────────────────────────────────────────── */}
      <div className="card p-5 mb-5">
        <SectionHeader
          title="Annual Coverage Record"
          sub={`$195 a year, included on Coastal Elite. ${money(coverageAnnual)} booked across current periods.`}
          action={<AddCoverageButton clients={clientOpts} label="Enroll client" primary={false} />}
        />
        {records.length === 0 ? (
          <Empty text="Nobody enrolled yet. Enroll a client and the due date drives the reminder." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[var(--mut)] text-left">
                  <th className="font-medium pb-2 pr-3">Client</th>
                  <th className="font-medium pb-2 pr-3">Period</th>
                  <th className="font-medium pb-2 pr-3">Send by</th>
                  <th className="font-medium pb-2 pr-3">Status</th>
                  <th className="font-medium pb-2 pr-3">Fee</th>
                  <th className="font-medium pb-2 pr-3">Record</th>
                  <th className="font-medium pb-2" />
                </tr>
              </thead>
              <tbody>
                {[...openRecords, ...sentRecords].map((r) => {
                  const late = r.status !== "SENT" && isOverdue(r.dueDate);
                  const days = daysUntil(r.dueDate);
                  return (
                    <tr key={r.id} className="border-t border-[var(--border)]">
                      <td className="py-2.5 pr-3">
                        <Link href={`/clients/${r.clientId}`} className="font-medium hover:text-[var(--teal)] transition-colors">
                          {r.client.name}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-3 text-[var(--sec)]">
                        {fmtDate(r.periodStart)} to {fmtDate(r.periodEnd)}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span className={late ? "text-[var(--bad)] font-medium" : "text-[var(--sec)]"}>
                          {fmtDate(r.dueDate)}
                        </span>
                        {r.status !== "SENT" && (
                          <p className="text-[11.5px] text-[var(--mut)]">
                            {late ? `${Math.abs(days)} days late` : `in ${days} days`}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        <StatusBadge status={r.status} />
                        {r.sentDate && (
                          <p className="text-[11.5px] text-[var(--mut)] mt-1">{fmtDate(r.sentDate)}</p>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 tabular-nums text-[var(--sec)]">
                        {r.fee ? money(r.fee) : "Included"}
                      </td>
                      <td className="py-2.5 pr-3">
                        <Link
                          href={`/print/coverage/${r.id}`}
                          target="_blank"
                          className="text-[var(--teal)] hover:underline"
                          title="Builds the PDF from every finalized visit report in the period"
                        >
                          Build PDF
                        </Link>
                        {r.fileUrl && (
                          <a href={r.fileUrl} target="_blank" rel="noreferrer" className="ml-2 text-[var(--mut)] hover:underline">
                            Saved copy
                          </a>
                        )}
                      </td>
                      <td className="py-2.5 text-right">
                        <CoverageActions clients={clientOpts} record={coverageDefaults(r)} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Alert history ───────────────────────────────────────────────── */}
      <div className="card p-5 mb-5">
        <SectionHeader
          title="Alert history"
          sub="Every alert and what you did about it. This is the part that ends up in the record."
          action={<AddAlertButton devices={deviceOpts} />}
        />
        {alerts.length === 0 ? (
          <Empty text="No alerts logged. Quiet is the goal." />
        ) : (
          <div className="space-y-1">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-3 py-2.5 border-b border-[var(--border)] last:border-0">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-medium">
                    {a.device.client.name} · {ALERT_KIND_LABEL[a.kind] ?? a.kind}
                    {a.resolvedAt == null && (
                      <span className="ml-2 text-[11.5px] text-[var(--warn)]">open</span>
                    )}
                  </p>
                  <p className="text-[12px] text-[var(--mut)]">
                    {fmtDate(a.occurredAt)}
                    {a.device.property?.address ? ` · ${a.device.property.address}` : ""} · {a.summary}
                  </p>
                  {a.action && (
                    <p className="text-[12px] text-[var(--sec)] mt-0.5">What you did: {a.action}</p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge status={a.severity} />
                  <AlertActions
                    devices={deviceOpts}
                    alert={{
                      id: a.id,
                      deviceId: a.deviceId,
                      occurredAt: toInputDate(a.occurredAt),
                      kind: a.kind,
                      severity: a.severity,
                      summary: a.summary,
                      action: a.action,
                      resolvedAt: toInputDate(a.resolvedAt),
                      notes: a.notes,
                      resolved: a.resolvedAt != null,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── The upsell list ─────────────────────────────────────────────── */}
      <div className="card p-5">
        <SectionHeader
          title="Not on protection yet"
          sub="Active clients with no shutoff device and no coverage record. This is the call list."
        />
        {unprotected.length === 0 ? (
          <Empty text="Everybody active is on at least one of the two. Good." />
        ) : (
          <div className="flex flex-wrap gap-2">
            {unprotected.map((c) => (
              <Link
                key={c.id}
                href={`/clients/${c.id}`}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-[13px] hover:border-[var(--teal)] transition-colors"
              >
                {c.name}
                {c.planName && <span className="text-[var(--mut)]"> · {c.planName}</span>}
              </Link>
            ))}
          </div>
        )}
      </div>
    </Reveal>
  );
}

/* ── Row to form defaults ───────────────────────────────────────────────── */

type DeviceRow = Awaited<ReturnType<typeof loadDevice>>;
async function loadDevice() {
  return prisma.shutoffDevice.findFirstOrThrow({
    include: {
      client: { select: { id: true, name: true } },
      property: { select: { address: true } },
      alerts: { take: 1 },
    },
  });
}

function deviceDefaults(d: DeviceRow) {
  return {
    id: d.id,
    clientId: d.clientId,
    propertyId: d.propertyId,
    status: d.status,
    brand: d.brand,
    model: d.model,
    serialNumber: d.serialNumber,
    installDate: toInputDate(d.installDate),
    installedBy: d.installedBy,
    installPrice: d.installPrice == null ? null : num(d.installPrice),
    installCost: d.installCost == null ? null : num(d.installCost),
    monitored: d.monitored,
    monitoringFee: d.monitoringFee == null ? null : num(d.monitoringFee),
    lastCheckedAt: toInputDate(d.lastCheckedAt),
    warrantyEnd: toInputDate(d.warrantyEnd),
    notes: d.notes,
  };
}

type RecordRow = Awaited<ReturnType<typeof loadRecord>>;
async function loadRecord() {
  return prisma.coverageRecord.findFirstOrThrow({
    include: { client: { select: { id: true, name: true } } },
  });
}

function coverageDefaults(r: RecordRow) {
  return {
    id: r.id,
    clientId: r.clientId,
    periodStart: toInputDate(r.periodStart),
    periodEnd: toInputDate(r.periodEnd),
    dueDate: toInputDate(r.dueDate),
    status: r.status,
    sentDate: toInputDate(r.sentDate),
    fee: r.fee == null ? null : num(r.fee),
    fileUrl: r.fileUrl,
    visitCount: r.visitCount,
    photoCount: r.photoCount,
    notes: r.notes,
  };
}
