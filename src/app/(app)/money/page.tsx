import Link from "next/link";
import { prisma } from "@/lib/db";
import { money, num, fmtDate, fmtMonth, toInputDate, isOverdue } from "@/lib/format";
import { AddPaymentButton, PaymentActions, AddExpenseButton, ExpenseActions } from "@/components/launchers";
import SquareSync from "@/components/SquareSync";
import InvoiceCosts from "@/components/InvoiceCosts";
import { squareConfigured } from "@/lib/square";
import { StatusBadge, Empty, CATEGORY_LABEL, EXPENSE_LABEL } from "@/components/ui";
import StatTile from "@/components/StatTile";
import Reveal from "@/components/Reveal";
import { IconChevronL, IconChevronR } from "@/components/icons";

export const dynamic = "force-dynamic";

function parseMonth(m?: string): Date {
  if (m) {
    const match = m.match(/^(\d{4})-(\d{2})$/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

function mk(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

const PAYMENT_INCLUDE = {
  client: { select: { id: true, name: true } },
  expenses: true,
} as const;

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; tab?: string; new?: string }>;
}) {
  const sp = await searchParams;
  const month = parseMonth(sp.m);
  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const prevMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const isExpenses = sp.tab === "expenses";

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const isCurrentMonth = month.getTime() === thisMonthStart.getTime();

  // Every tile is scoped to the month on screen.
  // Deliberate exception: in the CURRENT month view, unpaid invoices whose due
  // date already passed roll forward, because that money is still owed today.
  // Undated invoices land in the current month too so they can never disappear.
  const dueWhere = isCurrentMonth
    ? { status: "DUE" as const, OR: [{ dueDate: { lt: nextMonth } }, { dueDate: null }] }
    : { status: "DUE" as const, dueDate: { gte: month, lt: nextMonth } };

  const upcomingWhere = isCurrentMonth
    ? { status: "UPCOMING" as const, OR: [{ dueDate: { lt: nextMonth } }, { dueDate: null }] }
    : { status: "UPCOMING" as const, dueDate: { gte: month, lt: nextMonth } };

  const [paidInMonth, due, upcoming, expensesInMonth, clients, workers, syncState, linkables] =
    await Promise.all([
      prisma.payment.findMany({
        where: { status: "PAID", paidDate: { gte: month, lt: nextMonth } },
        include: PAYMENT_INCLUDE,
        orderBy: { paidDate: "desc" },
      }),
      prisma.payment.findMany({
        where: dueWhere,
        include: PAYMENT_INCLUDE,
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
      }),
      prisma.payment.findMany({
        where: upcomingWhere,
        include: PAYMENT_INCLUDE,
        orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
      }),
      prisma.expense.findMany({
        where: { date: { gte: month, lt: nextMonth } },
        include: {
          worker: { select: { name: true } },
          payment: { select: { invoiceNumber: true } },
          client: { select: { name: true } },
        },
        orderBy: { date: "desc" },
      }),
      prisma.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.worker.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
      prisma.appState.findUnique({ where: { key: "lastSquareSync" } }),
      // Not month-scoped on purpose: the expense form links costs to any recent invoice.
      prisma.payment.findMany({
        where: {
          OR: [
            { status: { in: ["DUE", "UPCOMING"] } },
            { paidDate: { gte: new Date(now.getFullYear() - 1, now.getMonth(), 1) } },
          ],
        },
        select: { id: true, invoiceNumber: true, amount: true, client: { select: { name: true } } },
        orderBy: [{ dueDate: { sort: "desc", nulls: "last" } }],
      }),
    ]);

  const collected = paidInMonth.reduce((s, p) => s + num(p.amount), 0);
  const outstanding = due.reduce((s, p) => s + num(p.amount), 0);
  const upcomingSum = upcoming.reduce((s, p) => s + num(p.amount), 0);
  const overdue = due.filter((p) => isOverdue(p.dueDate)).reduce((s, p) => s + num(p.amount), 0);
  const spent = expensesInMonth.reduce((s, e) => s + num(e.amount), 0);
  const carriedOver = due.filter((p) => p.dueDate && p.dueDate < month).length;

  const waitingSub =
    due.length === 0
      ? isCurrentMonth
        ? "Nothing sent and unpaid"
        : `Nothing was due in ${fmtMonth(month)}`
      : overdue > 0
        ? `${money(overdue)} overdue, chase it${carriedOver > 0 ? ` (${carriedOver} from earlier)` : ""}`
        : `${due.length} sent, none overdue`;

  const waitingTone: "good" | "bad" = overdue > 0 ? "bad" : "good";

  const upcomingSub =
    upcoming.length === 0
      ? `Nothing scheduled for ${fmtMonth(month)}`
      : `${upcoming.length} scheduled for ${fmtMonth(month)}, not sent yet`;

  const paymentOpts = linkables.map((p) => ({
    id: p.id,
    label: `${p.invoiceNumber ? `#${p.invoiceNumber} · ` : ""}${p.client?.name ?? "No client"} · ${money(p.amount)}`,
  }));

  const paymentRow = (p: (typeof paidInMonth)[number], showStatus = false) => {
    const isOver = p.status === "DUE" && isOverdue(p.dueDate);
    return (
      <tr key={p.id} className="tr-row">
        <td className="td text-[12.5px] text-[var(--mut)] whitespace-nowrap">
          {p.status === "PAID"
            ? fmtDate(p.paidDate)
            : p.status === "UPCOMING"
              ? p.dueDate ? `Sends ${fmtDate(p.dueDate)}` : "Scheduled"
              : p.dueDate ? `Due ${fmtDate(p.dueDate)}` : "Due"}
        </td>
        <td className="td">
          {p.client ? (
            <Link href={`/clients/${p.client.id}`} className="font-medium hover:text-[var(--teal)] transition-colors">
              {p.client.name}
            </Link>
          ) : (
            <span className="text-[var(--mut)]">No client</span>
          )}
          {p.description && <span className="block text-[12px] text-[var(--mut)] truncate max-w-[260px]">{p.description}</span>}
        </td>
        <td className="td"><span className="badge badge-mut">{CATEGORY_LABEL[p.category]}</span></td>
        <td className="td text-[12.5px] text-[var(--mut)]">{p.method?.toLowerCase() ?? ""}</td>
        <td className="td text-right">
          <span className={`font-semibold tabular-nums ${isOver ? "text-[var(--bad)]" : p.status === "DUE" ? "text-[var(--warn)]" : ""}`}>
            {money(p.amount)}
          </span>
        </td>
        {showStatus && <td className="td"><StatusBadge status={p.status === "DUE" && isOver ? "OVERDUE" : p.status} /></td>}
        <td className="td text-right">
          <span className="inline-flex items-center gap-1.5">
          <InvoiceCosts
            payment={{
              id: p.id,
              amount: num(p.amount),
              label: `${p.client?.name ?? "No client"} · ${p.description ?? CATEGORY_LABEL[p.category]}${p.invoiceNumber ? ` · #${p.invoiceNumber}` : ""}`,
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
            clients={clients}
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
          </span>
        </td>
      </tr>
    );
  };

  return (
    <Reveal className="in">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <p className="eyebrow mb-1.5">Every dollar in and out</p>
          <h1 className="display font-semibold text-[28px] leading-none tracking-tight" style={{ fontStretch: "118%" }}>
            Money
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SquareSync configured={squareConfigured()} lastSync={syncState?.value ?? null} />
          <AddExpenseButton workers={workers} clients={clients} payments={paymentOpts} primary={false} autoOpen={sp.new === "1" && isExpenses} />
          <AddPaymentButton clients={clients} autoOpen={sp.new === "1" && !isExpenses} />
        </div>
      </div>

      {/* Month nav + tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-1">
          <Link href={`/money?m=${mk(prevMonth)}${isExpenses ? "&tab=expenses" : ""}`} className="btn btn-sm"><IconChevronL size={14} /></Link>
          <span className="display font-semibold text-[15px] px-2 min-w-[110px] text-center" style={{ fontStretch: "112%" }}>
            {fmtMonth(month)}
          </span>
          <Link href={`/money?m=${mk(nextMonth)}${isExpenses ? "&tab=expenses" : ""}`} className="btn btn-sm"><IconChevronR size={14} /></Link>
          {!isCurrentMonth && (
            <Link href={`/money${isExpenses ? "?tab=expenses" : ""}`} className="btn btn-sm ml-1.5">This month</Link>
          )}
        </div>
        <div className="flex gap-1.5">
          <Link href={`/money?m=${mk(month)}`} className={`btn btn-sm ${!isExpenses ? "btn-primary" : ""}`}>Payments</Link>
          <Link href={`/money?m=${mk(month)}&tab=expenses`} className={`btn btn-sm ${isExpenses ? "btn-primary" : ""}`}>Expenses</Link>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        <StatTile label={`Collected ${fmtMonth(month)}`} value={collected} money accent />
        <StatTile label="Waiting on" value={outstanding} money sub={waitingSub} subTone={waitingTone} />
        <StatTile label="Upcoming" value={upcomingSum} money sub={upcomingSub} />
        <StatTile label={`Spent ${fmtMonth(month)}`} value={spent} money />
      </div>

      {!isExpenses ? (
        <div className="space-y-5">
          {due.length > 0 && (
            <div className="card overflow-x-auto">
              <p className="eyebrow px-4 pt-4">Waiting on ({due.length}) · sent and unpaid</p>
              <table className="w-full min-w-[760px]">
                <tbody>{due.map((p) => paymentRow(p, true))}</tbody>
              </table>
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="card overflow-x-auto">
              <p className="eyebrow px-4 pt-4">
                Upcoming ({upcoming.length}) · scheduled for {fmtMonth(month)}, not sent yet
              </p>
              <table className="w-full min-w-[760px]">
                <tbody>{upcoming.map((p) => paymentRow(p, true))}</tbody>
              </table>
            </div>
          )}

          <div className="card overflow-x-auto">
            <p className="eyebrow px-4 pt-4">Collected in {fmtMonth(month)}</p>
            {paidInMonth.length === 0 ? (
              <Empty text="Nothing collected this month yet." />
            ) : (
              <table className="w-full min-w-[760px]">
                <tbody>{paidInMonth.map((p) => paymentRow(p))}</tbody>
              </table>
            )}
          </div>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <p className="eyebrow px-4 pt-4">Expenses in {fmtMonth(month)}</p>
          {expensesInMonth.length === 0 ? (
            <Empty text="No expenses logged this month." />
          ) : (
            <table className="w-full min-w-[680px]">
              <tbody>
                {expensesInMonth.map((e) => (
                  <tr key={e.id} className="tr-row">
                    <td className="td text-[12.5px] text-[var(--mut)] whitespace-nowrap">{fmtDate(e.date)}</td>
                    <td className="td">
                      <span className="font-medium">{e.description ?? e.vendor ?? EXPENSE_LABEL[e.category]}</span>
                      <span className="block text-[12px] text-[var(--mut)]">
                        {[
                          e.worker?.name,
                          e.client?.name,
                          e.payment ? `invoice #${e.payment.invoiceNumber ?? ""}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </td>
                    <td className="td"><span className="badge badge-mut">{EXPENSE_LABEL[e.category]}</span></td>
                    <td className="td text-[12.5px] text-[var(--mut)]">{e.vendor ?? ""}</td>
                    <td className="td text-right font-semibold tabular-nums">{money(e.amount)}</td>
                    <td className="td text-right">
                      <ExpenseActions
                        workers={workers}
                        clients={clients}
                        payments={paymentOpts}
                        expense={{
                          id: e.id,
                          date: toInputDate(e.date),
                          amount: num(e.amount),
                          category: e.category,
                          vendor: e.vendor,
                          description: e.description,
                          workerId: e.workerId,
                          clientId: e.clientId,
                          paymentId: e.paymentId,
                        }}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Reveal>
  );
}
