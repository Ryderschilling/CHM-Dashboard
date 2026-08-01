/**
 * What a single job is worth, and what it leaves behind.
 *
 * Ryder does almost every job himself, so "spread" (charge minus a worker's
 * pay) was meaningless most of the time. What he actually wants per visit is:
 *
 *   value  = what the client is paying for this visit
 *   profit = value minus whatever he paid someone else to do it
 *
 * Value is explicit when the job carries a one-off charge. When it does not,
 * the visit is covered by the client's monthly plan, so we allocate an even
 * share of that plan across every visit that client has in the same month.
 * A $100/mo client with 4 visits in August makes each visit worth $25.
 * That is what makes a per-visit profit number honest instead of showing $0
 * for every retainer visit.
 */
import { num } from "@/lib/format";

export type ValuedJobInput = {
  id: string;
  clientId: string | null;
  date: Date;
  chargeAmount: unknown;
  laborCost: unknown;
  laborHours?: unknown;
  client?: { cadence?: string | null; planAmount?: unknown } | null;
};

export type JobValue = {
  /** What this visit is worth to the business. */
  value: number;
  /** True when value came from the client's plan rather than an explicit charge. */
  fromPlan: boolean;
  /** How many of the client's visits that month the plan was split across. */
  planSplit: number;
  /** Paid out to a worker. */
  labor: number;
  /** value minus labor. */
  profit: number;
  hours: number | null;
};

function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

/**
 * Value every job in one pass. Plan allocation needs the whole set, because
 * the divisor is "how many visits does this client have this month", so this
 * takes the full list rather than working job by job.
 */
export function valueJobs<T extends ValuedJobInput>(jobs: T[]): Map<string, JobValue> {
  // count each client's plan-covered visits per month
  const counts = new Map<string, number>();
  for (const j of jobs) {
    if (!j.clientId) continue;
    if (j.chargeAmount != null) continue; // explicitly priced, not drawing on the plan
    if (j.client?.cadence !== "MONTHLY" || j.client?.planAmount == null) continue;
    const k = `${j.clientId}|${monthKeyOf(j.date)}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }

  const out = new Map<string, JobValue>();
  for (const j of jobs) {
    const labor = num(j.laborCost);
    const hours = j.laborHours == null ? null : num(j.laborHours);

    let value = 0;
    let fromPlan = false;
    let planSplit = 0;

    if (j.chargeAmount != null) {
      value = num(j.chargeAmount);
    } else if (j.clientId && j.client?.cadence === "MONTHLY" && j.client?.planAmount != null) {
      const k = `${j.clientId}|${monthKeyOf(j.date)}`;
      planSplit = counts.get(k) ?? 1;
      value = num(j.client.planAmount) / planSplit;
      fromPlan = true;
    }

    out.set(j.id, { value, fromPlan, planSplit, labor, profit: value - labor, hours });
  }
  return out;
}

/** Hours to a short label: 1.5 -> "1h 30m", 2 -> "2h", 0.25 -> "15m". */
export function fmtHours(h: number | null | undefined): string {
  if (h == null || h <= 0) return "";
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  if (whole && mins) return `${whole}h ${mins}m`;
  if (whole) return `${whole}h`;
  return `${mins}m`;
}
