import Link from "next/link";
import { getDashboard } from "@/lib/metrics";
import { money, fmtMonth, parseMonthParam, monthParam } from "@/lib/format";
import StatTile from "@/components/StatTile";
import Reveal from "@/components/Reveal";
import { SectionHeader } from "@/components/ui";
import MoneyLedger from "@/components/MoneyLedger";
import { IconChevronL, IconChevronR } from "@/components/icons";

/**
 * Money, back as its own page 2026-08-20.
 *
 * It was folded into the Dashboard on 8/5 and pulled back out because the
 * ledger sat below three cards' worth of scroll. The Dashboard now stops at
 * the charts and the agenda; every invoice and expense lives here.
 *
 * One `?m=YYYY-MM` drives the tiles and the ledger. `?tab=expenses` flips the
 * ledger. `?new=1` auto-opens the payment (or expense) form.
 */

export const dynamic = "force-dynamic";

export default async function MoneyPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; tab?: string; new?: string }>;
}) {
  const sp = await searchParams;
  const month = parseMonthParam(sp.m);
  const prevMonth = new Date(month.getFullYear(), month.getMonth() - 1, 1);
  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  const monthName = fmtMonth(month);
  const d = await getDashboard(month);

  const qs = (m: Date) => {
    const p = new URLSearchParams({ m: monthParam(m) });
    if (sp.tab) p.set("tab", sp.tab);
    return `/money?${p}`;
  };

  return (
    <div className="aurora -mx-4 md:-mx-8 px-4 md:px-8 pt-2">
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
          <div>
            <p className="eyebrow mb-1.5">Coastal Home Mgmt 30A</p>
            <h1 className="display font-semibold text-[30px] leading-none tracking-tight" style={{ fontStretch: "118%" }}>
              Money
            </h1>
          </div>
          <div className="flex gap-2">
            <Link href={`/money?m=${monthParam(month)}&new=1`} className="btn btn-primary">Log payment</Link>
            <Link href={`/money?m=${monthParam(month)}&tab=expenses&new=1`} className="btn">Add expense</Link>
          </div>
        </div>
      </Reveal>

      {/* Month filter */}
      <Reveal delay={40}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-1">
            <Link href={qs(prevMonth)} className="btn btn-sm"><IconChevronL size={14} /></Link>
            <span className="display font-semibold text-[15px] px-2 min-w-[110px] text-center" style={{ fontStretch: "112%" }}>
              {monthName}
            </span>
            <Link href={qs(nextMonth)} className="btn btn-sm"><IconChevronR size={14} /></Link>
            {!d.isCurrentMonth && <Link href="/money" className="btn btn-sm ml-1.5">This month</Link>}
          </div>
          <p className="text-[11.5px] text-[var(--mut)]">
            Tiles and the ledger below both follow {monthName}.
          </p>
        </div>
      </Reveal>

      {/* Tiles: the four money numbers for the month */}
      <Reveal delay={60}>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
          <StatTile label={`Collected ${monthName}`} value={d.collectedMTD} money accent sub="Money actually in" />
          <StatTile
            label="Waiting on"
            value={d.outstanding}
            money
            sub={
              d.overdueCount > 0
                ? `${money(d.overdue)} overdue`
                : d.upcomingSum > 0
                  ? `+${money(d.upcomingSum)} scheduled soon`
                  : d.isCurrentMonth
                    ? "Nothing overdue"
                    : `Nothing was due in ${monthName}`
            }
            subTone={d.overdueCount > 0 ? "bad" : d.upcomingSum > 0 ? "mut" : "good"}
          />
          <StatTile label="Labor + expenses" value={d.laborMTD + d.expensesMTD} money sub={`Cost in ${monthName}`} />
          <StatTile
            label={`Profit ${monthName}`}
            value={d.profitMTD}
            money
            sub="After labor and expenses"
            subTone={d.profitMTD >= 0 ? "good" : "bad"}
          />
        </div>
      </Reveal>

      <Reveal delay={100}>
        <div className="mb-8">
          <SectionHeader
            title="Invoices and expenses"
            sub={`Everything in and out for ${monthName}. Unpaid invoices from earlier months roll into the current month so nothing gets lost.`}
          />
          <MoneyLedger month={month} tab={sp.tab} autoOpen={sp.new === "1"} />
        </div>
      </Reveal>
    </div>
  );
}
