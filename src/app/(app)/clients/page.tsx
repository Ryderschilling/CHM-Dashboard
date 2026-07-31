import Link from "next/link";
import { prisma } from "@/lib/db";
import { money, num, fmtDate } from "@/lib/format";
import { AddClientButton } from "@/components/launchers";
import { SectionHeader, StatusBadge, Empty, CADENCE_LABEL } from "@/components/ui";
import Reveal from "@/components/Reveal";

export const dynamic = "force-dynamic";

const FILTERS = [
  { key: "", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "LEAD", label: "Leads" },
  { key: "PAUSED", label: "Paused" },
  { key: "FORMER", label: "Former" },
];

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; new?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() ?? "";
  const status = sp.status ?? "";

  const clients = await prisma.client.findMany({
    where: {
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
      ...(status ? { status: status as never } : {}),
    },
    include: {
      properties: { select: { address: true }, take: 1 },
      payments: { where: { status: "DUE" }, select: { amount: true } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  const totalMrr = clients
    .filter((c) => c.status === "ACTIVE" && c.cadence === "MONTHLY")
    .reduce((s, c) => s + num(c.planAmount), 0);

  return (
    <Reveal className="in">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow mb-1.5">{clients.length} shown · {money(totalMrr)}/mo recurring</p>
          <h1 className="display font-semibold text-[28px] leading-none tracking-tight" style={{ fontStretch: "118%" }}>
            Clients
          </h1>
        </div>
        <AddClientButton autoOpen={sp.new === "1"} />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <form className="flex-1 min-w-[200px] max-w-[320px]">
          {status && <input type="hidden" name="status" value={status} />}
          <input
            name="q"
            defaultValue={q}
            className="input"
            placeholder="Search clients..."
          />
        </form>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={`/clients${f.key ? `?status=${f.key}` : ""}${q ? `${f.key ? "&" : "?"}q=${encodeURIComponent(q)}` : ""}`}
              className={`btn btn-sm ${status === f.key ? "btn-primary" : ""}`}
            >
              {f.label}
            </Link>
          ))}
        </div>
      </div>

      <div className="card overflow-x-auto">
        {clients.length === 0 ? (
          <Empty text={q ? `Nothing matching "${q}".` : "No clients yet. Add your first one."} />
        ) : (
          <table className="w-full min-w-[720px]">
            <thead>
              <tr className="border-b border-[var(--border)]">
                <th className="th">Client</th>
                <th className="th">Plan</th>
                <th className="th">Status</th>
                <th className="th text-right">Owes you</th>
                <th className="th text-right">Since</th>
                <th className="th" />
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => {
                const owed = c.payments.reduce((s, p) => s + num(p.amount), 0);
                return (
                  <tr key={c.id} className="tr-row">
                    <td className="td">
                      <Link href={`/clients/${c.id}`} className="block group">
                        <span className="font-semibold text-[14px] group-hover:text-[var(--teal)] transition-colors">
                          {c.name}
                        </span>
                        <span className="block text-[12px] text-[var(--mut)]">
                          {c.community ?? c.properties[0]?.address ?? ""}
                        </span>
                      </Link>
                    </td>
                    <td className="td">
                      {c.planName || c.planAmount ? (
                        <>
                          <span className="text-[13.5px]">{c.planName ?? "Custom"}</span>
                          <span className="block text-[12px] text-[var(--mut)]">
                            {c.planAmount ? `${money(c.planAmount)} ${CADENCE_LABEL[c.cadence]?.toLowerCase()}` : CADENCE_LABEL[c.cadence]}
                            {c.lockedRate ? " · locked" : ""}
                          </span>
                        </>
                      ) : (
                        <span className="text-[13px] text-[var(--mut)]">{CADENCE_LABEL[c.cadence]}</span>
                      )}
                    </td>
                    <td className="td"><StatusBadge status={c.status} /></td>
                    <td className="td text-right">
                      {owed > 0 ? (
                        <span className="font-semibold text-[var(--warn)] tabular-nums">{money(owed)}</span>
                      ) : (
                        <span className="text-[var(--mut)]">-</span>
                      )}
                    </td>
                    <td className="td text-right text-[12.5px] text-[var(--mut)]">
                      {c.startDate ? fmtDate(c.startDate) : ""}
                    </td>
                    <td className="td text-right">
                      <Link href={`/clients/${c.id}`} className="btn btn-sm">Open</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Reveal>
  );
}
