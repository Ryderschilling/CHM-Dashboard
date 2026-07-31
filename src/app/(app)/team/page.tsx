import { prisma } from "@/lib/db";
import { money, num, toInputDate, fmtDate, monthStart } from "@/lib/format";
import { AddWorkerButton, WorkerActions, AddExpenseButton, ExpenseActions } from "@/components/launchers";
import { SectionHeader, Empty } from "@/components/ui";
import StatTile from "@/components/StatTile";
import Reveal from "@/components/Reveal";

export const dynamic = "force-dynamic";

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ new?: string }>;
}) {
  const sp = await searchParams;
  const thisMonth = monthStart(0);

  const [workers, doneJobs, laborExpenses] = await Promise.all([
    prisma.worker.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
    prisma.job.findMany({
      where: { status: "DONE" },
      select: { workerId: true, laborCost: true, chargeAmount: true, date: true },
    }),
    prisma.expense.findMany({
      where: { category: "LABOR" },
      include: { worker: { select: { id: true, name: true } } },
      orderBy: { date: "desc" },
      take: 30,
    }),
  ]);

  const workerOpts = workers.filter((w) => w.active).map((w) => ({ id: w.id, name: w.name }));

  const statsFor = (workerId: string | null) => {
    const mine = doneJobs.filter((j) => j.workerId === workerId);
    const mtd = mine.filter((j) => j.date >= thisMonth);
    const paidAll =
      mine.reduce((s, j) => s + num(j.laborCost), 0) +
      laborExpenses.filter((e) => e.workerId === workerId).reduce((s, e) => s + num(e.amount), 0);
    const revenueAll = mine.reduce((s, j) => s + (j.chargeAmount == null ? 0 : num(j.chargeAmount)), 0);
    return {
      jobsAll: mine.length,
      jobsMTD: mtd.length,
      laborMTD: mtd.reduce((s, j) => s + num(j.laborCost), 0),
      paidAll,
      revenueAll,
      spread: revenueAll - paidAll,
    };
  };

  const ryder = statsFor(null);
  const totalJobsMTD = doneJobs.filter((j) => j.date >= thisMonth).length;
  const teamJobsMTD = totalJobsMTD - ryder.jobsMTD;
  const teamLaborMTD = doneJobs
    .filter((j) => j.date >= thisMonth && j.workerId != null)
    .reduce((s, j) => s + num(j.laborCost), 0);
  const rydersShare = totalJobsMTD > 0 ? Math.round((ryder.jobsMTD / totalJobsMTD) * 100) : 100;
  const teamPaidAll =
    doneJobs.filter((j) => j.workerId != null).reduce((s, j) => s + num(j.laborCost), 0) +
    laborExpenses.filter((e) => e.workerId != null).reduce((s, e) => s + num(e.amount), 0);

  return (
    <Reveal className="in">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow mb-1.5">Who does the work and what it costs</p>
          <h1 className="display font-semibold text-[28px] leading-none tracking-tight" style={{ fontStretch: "118%" }}>
            Team
          </h1>
        </div>
        <div className="flex gap-2">
          <AddExpenseButton workers={workerOpts} defaults={{ category: "LABOR" }} label="Log payout" primary={false} />
          <AddWorkerButton autoOpen={sp.new === "1"} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile label="Jobs this month" value={totalJobsMTD} accent sub={`${ryder.jobsMTD} you · ${teamJobsMTD} team`} />
        <StatTile label="Your share of jobs" value={rydersShare} sub="Percent done by you" />
        <StatTile label="Team labor this month" value={teamLaborMTD} money />
        <StatTile label="Paid to team all time" value={teamPaidAll} money sub="Job labor plus payouts" />
      </div>

      {/* You vs team split */}
      {totalJobsMTD > 0 && (
        <div className="card p-5 mb-5">
          <SectionHeader title="You vs team" sub="Share of jobs done this month" />
          <div className="h-[14px] rounded-full overflow-hidden flex bg-[var(--surface-2)]">
            <div className="h-full" style={{ width: `${rydersShare}%`, background: "var(--s1)" }} />
            <div className="h-full" style={{ width: `${100 - rydersShare}%`, background: "var(--s2)", marginLeft: rydersShare > 0 && rydersShare < 100 ? 2 : 0 }} />
          </div>
          <div className="flex items-center gap-5 mt-2.5">
            <span className="flex items-center gap-1.5 text-[12.5px] text-[var(--sec)]">
              <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: "var(--s1)" }} />
              You ({ryder.jobsMTD})
            </span>
            <span className="flex items-center gap-1.5 text-[12.5px] text-[var(--sec)]">
              <span className="w-2.5 h-2.5 rounded-[3px]" style={{ background: "var(--s2)" }} />
              Team ({teamJobsMTD})
            </span>
          </div>
        </div>
      )}

      {/* Worker cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {/* Ryder card */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--teal)] text-[var(--teal-ink)] display font-bold">
                R
              </span>
              <div>
                <p className="font-semibold text-[15px]">You</p>
                <p className="text-[12px] text-[var(--mut)]">Owner operator</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-[var(--surface-2)] p-3">
              <p className="stat-num text-[20px]">{ryder.jobsMTD}</p>
              <p className="text-[11px] text-[var(--mut)] mt-1">Jobs this month</p>
            </div>
            <div className="rounded-xl bg-[var(--surface-2)] p-3">
              <p className="stat-num text-[20px]">{ryder.jobsAll}</p>
              <p className="text-[11px] text-[var(--mut)] mt-1">Jobs all time</p>
            </div>
          </div>
        </div>

        {workers.map((w) => {
          const s = statsFor(w.id);
          return (
            <div key={w.id} className={`card p-5 ${!w.active ? "opacity-55" : ""}`}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-[var(--surface-3)] display font-bold text-[var(--sec)]">
                    {w.name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <p className="font-semibold text-[15px]">{w.name}{!w.active ? " (inactive)" : ""}</p>
                    <p className="text-[12px] text-[var(--mut)]">
                      {w.defaultPay ? `Usually ${money(w.defaultPay)}/job` : w.payNote ?? "Per job"}
                    </p>
                  </div>
                </div>
                <WorkerActions
                  worker={{
                    id: w.id,
                    name: w.name,
                    phone: w.phone,
                    email: w.email,
                    defaultPay: w.defaultPay == null ? null : num(w.defaultPay),
                    payNote: w.payNote,
                    active: w.active,
                  }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3 text-center mb-3">
                <div className="rounded-xl bg-[var(--surface-2)] p-3">
                  <p className="stat-num text-[20px]">{s.jobsMTD}</p>
                  <p className="text-[11px] text-[var(--mut)] mt-1">Jobs this month</p>
                </div>
                <div className="rounded-xl bg-[var(--surface-2)] p-3">
                  <p className="stat-num text-[20px]">{money(s.laborMTD)}</p>
                  <p className="text-[11px] text-[var(--mut)] mt-1">Pay this month</p>
                </div>
              </div>
              <div className="text-[12.5px] text-[var(--sec)] space-y-1 border-t border-[var(--border)] pt-3">
                <p className="flex justify-between"><span>Paid all time</span><span className="tabular-nums font-medium">{money(s.paidAll)}</span></p>
                <p className="flex justify-between"><span>Revenue on their jobs</span><span className="tabular-nums font-medium">{money(s.revenueAll)}</span></p>
                <p className="flex justify-between">
                  <span>Your spread</span>
                  <span className={`tabular-nums font-semibold ${s.spread >= 0 ? "text-[var(--good)]" : "text-[var(--bad)]"}`}>{money(s.spread)}</span>
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Payout log */}
      <div className="card p-5">
        <SectionHeader title="Payout log" sub="Labor payouts outside of jobs (bonuses, weekly settle-ups)" />
        {laborExpenses.length === 0 ? (
          <Empty text="No standalone payouts logged. Job labor costs live on each job." />
        ) : (
          <div className="space-y-1">
            {laborExpenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-3 py-2 border-b border-[var(--border)] last:border-0">
                <div>
                  <p className="text-[13.5px] font-medium">{e.worker?.name ?? "Unassigned"}</p>
                  <p className="text-[12px] text-[var(--mut)]">{fmtDate(e.date)}{e.description ? ` · ${e.description}` : ""}</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="font-semibold tabular-nums">{money(e.amount)}</span>
                  <ExpenseActions
                    workers={workerOpts}
                    expense={{
                      id: e.id,
                      date: toInputDate(e.date),
                      amount: num(e.amount),
                      category: e.category,
                      vendor: e.vendor,
                      description: e.description,
                      workerId: e.workerId,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Reveal>
  );
}
