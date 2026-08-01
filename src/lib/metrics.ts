import { prisma } from "@/lib/db";
import { isOverdue, monthKey, monthStart, num } from "@/lib/format";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;

export async function getDashboard() {
  const now = new Date();
  const thisMonth = monthStart(0);
  const chartStart = monthStart(-11);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [activeClients, payments, jobs, expenses, openTasks, activeCount] = await Promise.all([
    prisma.client.findMany({
      where: { status: "ACTIVE" },
      select: { id: true, planAmount: true, cadence: true },
    }),
    prisma.payment.findMany({
      where: {
        OR: [
          { status: "PAID", paidDate: { gte: chartStart } },
          { status: { in: ["DUE", "UPCOMING"] } },
        ],
      },
      include: { client: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.job.findMany({
      where: { date: { gte: chartStart } },
      include: {
        client: { select: { id: true, name: true } },
        worker: { select: { id: true, name: true } },
      },
      orderBy: { date: "asc" },
    }),
    prisma.expense.findMany({ where: { date: { gte: chartStart } } }),
    prisma.task.findMany({
      where: { done: false },
      include: { client: { select: { id: true, name: true } } },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { priority: "desc" }],
      take: 12,
    }),
    prisma.client.count({ where: { status: "ACTIVE" } }),
  ]);

  // MRR: active clients on a monthly cadence with a filled amount
  const mrr = activeClients
    .filter((c) => c.cadence === "MONTHLY")
    .reduce((s, c) => s + num(c.planAmount), 0);
  const missingPlanAmounts = activeClients.filter(
    (c) => c.cadence === "MONTHLY" && c.planAmount == null
  ).length;

  const paid = payments.filter((p) => p.status === "PAID" && p.paidDate);
  const due = payments.filter((p) => p.status === "DUE");
  const upcomingPayments = payments.filter((p) => p.status === "UPCOMING");

  const collectedMTD = paid
    .filter((p) => (p.paidDate as Date) >= thisMonth)
    .reduce((s, p) => s + num(p.amount), 0);

  const outstanding = due.reduce((s, p) => s + num(p.amount), 0);
  const upcomingSum = upcomingPayments.reduce((s, p) => s + num(p.amount), 0);
  const overdueList = due.filter((p) => isOverdue(p.dueDate));
  const overdue = overdueList.reduce((s, p) => s + num(p.amount), 0);

  const doneJobs = jobs.filter((j) => j.status === "DONE");
  const laborMTD = doneJobs
    .filter((j) => j.date >= thisMonth)
    .reduce((s, j) => s + num(j.laborCost), 0);
  const expensesMTD = expenses
    .filter((e) => e.date >= thisMonth)
    .reduce((s, e) => s + num(e.amount), 0);
  const profitMTD = collectedMTD - laborMTD - expensesMTD;

  // MRR trend. Compares today's recurring base against the average monthly
  // PROFIT (collected minus job labor minus expenses) over the last 6 COMPLETE
  // months. The current partial month is excluded, and months with no activity
  // at all are skipped so the early ramp-up does not drag the average down.
  const profitMonths: number[] = [];
  for (let i = 6; i >= 1; i--) {
    const key = monthKey(monthStart(-i));
    const inflow = paid
      .filter((p) => monthKey(p.paidDate as Date) === key)
      .reduce((s, p) => s + num(p.amount), 0);
    const labor = doneJobs
      .filter((j) => monthKey(j.date) === key)
      .reduce((s, j) => s + num(j.laborCost), 0);
    const costs = expenses
      .filter((e) => monthKey(e.date) === key)
      .reduce((s, e) => s + num(e.amount), 0);
    if (inflow === 0 && labor === 0 && costs === 0) continue;
    profitMonths.push(inflow - labor - costs);
  }
  const mrrAvg = profitMonths.length
    ? profitMonths.reduce((a, b) => a + b, 0) / profitMonths.length
    : 0;
  const mrrAvgMonths = profitMonths.length;
  const mrrDeltaPct = mrrAvg > 0 ? ((mrr - mrrAvg) / mrrAvg) * 100 : null;

  // Revenue by month, last 12
  const revenue12: { label: string; a: number }[] = [];
  for (let i = 11; i >= 0; i--) {
    const m = monthStart(-i);
    const key = monthKey(m);
    const total = paid
      .filter((p) => monthKey(p.paidDate as Date) === key)
      .reduce((s, p) => s + num(p.amount), 0);
    revenue12.push({ label: MONTHS[m.getMonth()], a: total });
  }

  // Money in vs costs, last 6 months
  const inOut6: { label: string; a: number; b: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = monthStart(-i);
    const key = monthKey(m);
    const moneyIn = paid
      .filter((p) => monthKey(p.paidDate as Date) === key)
      .reduce((s, p) => s + num(p.amount), 0);
    const labor = doneJobs
      .filter((j) => monthKey(j.date) === key)
      .reduce((s, j) => s + num(j.laborCost), 0);
    const exp = expenses
      .filter((e) => monthKey(e.date) === key)
      .reduce((s, e) => s + num(e.amount), 0);
    inOut6.push({ label: MONTHS[m.getMonth()], a: moneyIn, b: labor + exp });
  }

  // Top clients by collected revenue, YTD
  const byClient = new Map<string, { label: string; value: number }>();
  for (const p of paid) {
    if ((p.paidDate as Date) < yearStart) continue;
    const key = p.client?.id ?? "none";
    const label = p.client?.name ?? "No client";
    const cur = byClient.get(key) ?? { label, value: 0 };
    cur.value += num(p.amount);
    byClient.set(key, cur);
  }
  const topClients = [...byClient.values()].sort((x, y) => y.value - x.value).slice(0, 7);

  const upcomingJobs = jobs
    .filter((j) => j.status === "SCHEDULED" && j.date >= new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    .slice(0, 8)
    .map((j) => ({
      id: j.id,
      title: j.title,
      date: j.date.toISOString(),
      clientName: j.client?.name ?? null,
      workerName: j.worker?.name ?? null,
    }));

  const attention = [
    ...overdueList.map((p) => ({
      kind: "payment" as const,
      id: p.id,
      text: `${p.client?.name ?? "No client"}: ${num(p.amount).toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 })} overdue`,
      href: "/money",
      due: p.dueDate?.toISOString() ?? null,
    })),
    ...openTasks
      .filter((t) => t.dueDate && isOverdue(t.dueDate))
      .map((t) => ({
        kind: "task" as const,
        id: t.id,
        text: t.title,
        href: "/tasks",
        due: t.dueDate?.toISOString() ?? null,
      })),
  ].slice(0, 6);

  return {
    mrr,
    mrrAvg,
    mrrAvgMonths,
    mrrDeltaPct,
    missingPlanAmounts,
    collectedMTD,
    outstanding,
    upcomingSum,
    overdue,
    overdueCount: overdueList.length,
    laborMTD,
    expensesMTD,
    profitMTD,
    activeCount,
    revenue12,
    inOut6,
    topClients,
    upcomingJobs,
    attention,
    openTaskCount: openTasks.length,
    dueSoonTasks: openTasks.slice(0, 6).map((t) => ({
      id: t.id,
      title: t.title,
      due: t.dueDate?.toISOString() ?? null,
      priority: t.priority,
      clientName: t.client?.name ?? null,
    })),
  };
}
