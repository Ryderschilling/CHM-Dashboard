import Link from "next/link";
import { prisma } from "@/lib/db";
import { money, num, fmtDate, fmtMonth, toInputDate, isOverdue, monthParam } from "@/lib/format";
import {
  AddPaymentButton,
  PaymentActions,
  AddExpenseButton,
  ExpenseActions,
} from "@/components/launchers";
import SquareSync from "@/components/SquareSync";
import InvoiceCosts from "@/components/InvoiceCosts";
import { squareConfigured } from "@/lib/square";
import { StatusBadge, Empty, CATEGORY_LABEL, EXPENSE_LABEL } from "@/components/ui";

/**
 * The invoice and expense ledger, lifted off the old /money page when Money
 * and Dashboard were merged 2026-08-05.
 *
 * It owns its own queries so the Dashboard page stays readable. Month comes in
 * from the Dashboard's `?m=` so one nav controls the whole page. The tiles that
 * used to sit above this list are NOT repeated: the Dashboard's own tiles
 * already say collected, waiting on, profit and costs for the same month.
 */

const PAYMENT_INCLUDE = {
  client: { select: { id: true, name: true } },
  expenses: true,
} as const;

export default async function MoneyLedger({
  month,
  tab,
  autoOpen,
}: {
  month: Date;
  tab?: string;
  autoOpen?: boolean;
}) {
  const isExpenses = tab === "expenses";
  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const isCurrentMonth = month.getTime() === thisMonthStart.getTime();

  // In the CURRENT month view, unpaid invoices whose due date already passed
  // roll forward, because that money is still owed today. Undated invoices land
  // in the current month too so they can never disappear.
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
      prisma.worker.findMany({
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
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

  const paymentOpts = linkables.map((p) => ({
    id: p.id,
    label: `${p.invoiceNumber ? `#${p.invoiceNumber} · ` : ""}${p.client?.name ?? "No client"} · ${money(p.amount)}`,
  }));

  const m = monthParam(month);

  const paymentRow = (p: (typeof paidInMonth)[number], showStatus = false) => {
    const isOver = p.status === "DUE" && isOverdue(p.dueDate);
    return (
      <tr key={p.id} className="tr-row">
        <td className="td text-[12.5px] text-[var(--mut)] whitespace-nowrap">
          {p.status === "PAID"
            ? fmtDate(p.paidDate)
            : p.status === "UPCOMING"
              ? p.dueDate
                ? `Sends ${fmtDate(p.dueDate)}`
                : "Scheduled"
              : p.dueDate
                ? `Due ${fmtDate(p.dueDate)}`
                : "Due"}
        </td>
        <td className="td">
          {p.client ? (
            <Link
              href={`/clients/${p.client.id}`}
              className="font-medium hover:text-[var(--teal)] transition-colors"
            >
              {p.client.name}
            </Link>
          ) : (
            <span className="text-[var(--mut)]">No client</span>
          )}
          {p.description && (
            <span className="block text-[12px] text-[var(--mut)] truncate max-w-[260px]">
              {p.description}
            </span>
          )}
        </td>
        <td className="td">
          <span className="badge badge-mut">{CATEGORY_LABEL[p.category]}</span>
        </td>
        <td className="td text-[12.5px] text-[var(--mut)]">{p.method?.toLowerCase() ?? ""}</td>
        <td className="td text-right">
          <span
            className={`font-semibold tabular-nums ${isOver ? "text-[var(--bad)]" : p.status === "DUE" ? "text-[var(--warn)]" : ""}`}
          >
            {money(p.amount)}
          </span>
        </td>
        {showStatus && (
          <td className="td">
            <StatusBadge status={p.status === "DUE" && isOver ? "OVERDUE" : p.status} />
          </td>
        )}
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
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="flex gap-1.5">
          <Link href={`/?m=${m}`} className={`btn btn-sm ${!isExpenses ? "btn-primary" : ""}`}>
            Invoices
          </Link>
          <Link
            href={`/?m=${m}&tab=expenses`}
            className={`btn btn-sm ${isExpenses ? "btn-primary" : ""}`}
          >
            Expenses
          </Link>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <SquareSync configured={squareConfigured()} lastSync={syncState?.value ?? null} />
          <AddExpenseButton
            workers={workers}
            clients={clients}
            payments={paymentOpts}
            primary={false}
            autoOpen={autoOpen && isExpenses}
          />
          <AddPaymentButton clients={clients} autoOpen={autoOpen && !isExpenses} />
        </div>
      </div>

      {!isExpenses ? (
        <div className="space-y-4">
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
                    <td className="td text-[12.5px] text-[var(--mut)] whitespace-nowrap">
                      {fmtDate(e.date)}
                    </td>
                    <td className="td">
                      <span className="font-medium">
                        {e.description ?? e.vendor ?? EXPENSE_LABEL[e.category]}
                      </span>
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
                    <td className="td">
                      <span className="badge badge-mut">{EXPENSE_LABEL[e.category]}</span>
                    </td>
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
    </div>
  );
}
