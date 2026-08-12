/**
 * What a single visit is worth, and what it leaves behind.
 *
 * THE MODEL (set 2026-08-05, after Ryder spelled out what he actually sells):
 * a monthly plan is a promise of PAY, not a promise of a visit count. The
 * client pays the same $135 whether the month took four stops or nine. Visits
 * flex with the weather, special requests, and whatever the house needs.
 *
 * So a plan visit is worth the plan DILUTED across every visit that month:
 *
 *     value per visit = planAmount / visits that client got this month
 *
 * There is no allowance and nothing to exceed. An extra visit does not earn
 * $0, it lowers what every visit that month was worth, which is exactly the
 * signal Ryder wants: over-servicing shows up as a falling dollars-per-hour,
 * not as a phantom unpaid job. `Client.visitsPerMonth` is now only the
 * BASELINE he priced the plan on, carried through for variance reporting
 * (see lib/planLedger.ts). It is never the divisor.
 *
 * Three ways a visit gets a value, checked in this order:
 *
 *   1. CHARGE  an explicit one-off charge on the job. Always wins, even on a
 *              plan client. This is how extra work gets paid on top.
 *   2. PLAN    a monthly client. planAmount over that client's visits in the
 *              same calendar month.
 *   3. RATE    an off-plan client (per visit or ad hoc) whose planAmount is a
 *              flat rate per visit. $20 a visit is $20, no division.
 *
 * IMPORTANT: the divisor is a whole client-month. Any caller showing a window
 * SHORTER than a month (the Jobs list, a single visit) must pass `counts`
 * built from the full month, or every plan visit reads too high.
 */
import { num } from "@/lib/format";
import { jobMinutes } from "@/lib/duration";

export type ValuedJobInput = {
  id: string;
  clientId: string | null;
  date: Date;
  chargeAmount: unknown;
  laborCost: unknown;
  /** Whole minutes. The real column. */
  laborMinutes?: number | null;
  /** Deprecated decimal hours, read only until the backfill has run. */
  laborHours?: unknown;
  /** CANCELED visits never dilute a plan. */
  status?: string | null;
  client?: {
    cadence?: string | null;
    planAmount?: unknown;
    visitsPerMonth?: number | null;
  } | null;
};

/** Where the number came from. Drives what the row says under the money. */
export type ValueKind = "charge" | "plan" | "rate" | "none";

export type JobValue = {
  /** What this visit is worth to the business. */
  value: number;
  kind: ValueKind;
  /** How many visits the month's plan got diluted across. 0 when not a plan. */
  planSplit: number;
  /** What the plan was priced on, when Ryder recorded it. Null when he has not. */
  planBaseline: number | null;
  /** Paid out to a worker. */
  labor: number;
  /** value minus labor. */
  profit: number;
  /** How long it took, in whole minutes. Null means nobody timed it. */
  minutes: number | null;
};

/** Key for one client's one month. Same shape used by planCounts and valueJobs. */
export function planKey(clientId: string, d: Date): string {
  return `${clientId}|${d.getFullYear()}-${d.getMonth()}`;
}

const isMonthly = (c: ValuedJobInput["client"]) => c?.cadence === "MONTHLY";

/** True when this visit is one the monthly plan is paying for. */
function drawsOnPlan(j: ValuedJobInput): boolean {
  if (!j.clientId) return false;
  if (j.status === "CANCELED") return false;
  if (j.chargeAmount != null) return false; // priced on its own, not off the plan
  return isMonthly(j.client) && j.client?.planAmount != null;
}

/**
 * How many plan visits each client got in each month of the set you pass.
 *
 * Feed this WHOLE months. Hand the result to valueJobs when the list you are
 * rendering is narrower than a month.
 */
export function planCounts(jobs: ValuedJobInput[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const j of jobs) {
    if (!drawsOnPlan(j)) continue;
    const k = planKey(j.clientId!, j.date);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

/**
 * Value every job in one pass.
 *
 * `counts` overrides the divisor, so a seven-day view can still divide by the
 * real month. Without it the divisor is counted from `jobs` itself, which is
 * only correct when `jobs` is a full month.
 */
export function valueJobs<T extends ValuedJobInput>(
  jobs: T[],
  counts?: Map<string, number>,
): Map<string, JobValue> {
  const divisors = counts ?? planCounts(jobs);

  const out = new Map<string, JobValue>();
  for (const j of jobs) {
    const labor = num(j.laborCost);
    const minutes = jobMinutes(j);
    const base = { labor, minutes, planBaseline: j.client?.visitsPerMonth ?? null };

    // 1. An explicit charge always wins.
    if (j.chargeAmount != null) {
      const value = num(j.chargeAmount);
      out.set(j.id, { ...base, value, kind: "charge", planSplit: 0, profit: value - labor });
      continue;
    }

    const planAmount = j.client?.planAmount == null ? null : num(j.client.planAmount);

    // 2. Monthly plan: fixed money, diluted across the month's visits.
    if (drawsOnPlan(j) && planAmount != null) {
      const split = Math.max(1, divisors.get(planKey(j.clientId!, j.date)) ?? 1);
      const value = planAmount / split;
      out.set(j.id, { ...base, value, kind: "plan", planSplit: split, profit: value - labor });
      continue;
    }

    // 3. Off plan with a flat rate per visit.
    if (j.clientId && !isMonthly(j.client) && planAmount != null && planAmount > 0) {
      out.set(j.id, { ...base, value: planAmount, kind: "rate", planSplit: 0, profit: planAmount - labor });
      continue;
    }

    // 4. No client, a canceled visit, or a client with nothing set.
    out.set(j.id, { ...base, value: 0, kind: "none", planSplit: 0, profit: -labor });
  }
  return out;
}

/**
 * Kept as a re-export so callers have one import path for money-and-time on a
 * job. Formatting itself lives in lib/duration.ts.
 */
export { fmtDur } from "@/lib/duration";
