/**
 * What a single visit is worth, and what it leaves behind.
 *
 * Ryder does almost every job himself, so "spread" (charge minus a worker's
 * pay) was meaningless most of the time. What he actually wants per visit is:
 *
 *   value  = what the client is paying for THIS visit
 *   profit = value minus whatever he paid someone else to do it
 *
 * There are four ways a visit gets a value, checked in this order:
 *
 *   1. CHARGE  an explicit one-off charge on the job. Always wins, even on a
 *              plan client. This is how an extra visit or extra work gets paid.
 *   2. PLAN    a monthly client. The plan is split across the number of visits
 *              a month that client is SUPPOSED to get (Client.visitsPerMonth).
 *              $135 with 4 visits a month is $33.75 a visit, every month,
 *              whatever the calendar happens to look like.
 *   3. RATE    an off-plan client (per visit or ad hoc) whose planAmount is a
 *              flat rate per visit. $20 a visit is $20, no division.
 *   4. OVER    a monthly client who already got their visits this month. Worth
 *              $0, flagged, because the plan does not pay twice. The visit
 *              still counts toward time and visit counts, so over-servicing
 *              shows up as a falling dollars-per-hour instead of hiding.
 *
 * When visitsPerMonth is not set on a monthly client, the divisor falls back
 * to however many plan-covered visits that client has that month. That is the
 * old behavior, kept so nothing changes until Ryder fills the number in.
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
  client?: {
    cadence?: string | null;
    planAmount?: unknown;
    visitsPerMonth?: number | null;
  } | null;
};

/** Where the number came from. Drives what the row says under the money. */
export type ValueKind = "charge" | "plan" | "rate" | "over" | "none";

export type JobValue = {
  /** What this visit is worth to the business. */
  value: number;
  kind: ValueKind;
  /** How many visits the monthly plan was split across. 0 when not a plan. */
  planSplit: number;
  /** True when the divisor came from the client record, not the calendar. */
  splitDeclared: boolean;
  /** Paid out to a worker. */
  labor: number;
  /** value minus labor. */
  profit: number;
  /** How long it took, in whole minutes. Null means nobody timed it. */
  minutes: number | null;
};

function monthKeyOf(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}`;
}

const isMonthly = (c: ValuedJobInput["client"]) => c?.cadence === "MONTHLY";

/**
 * Value every job in one pass. Plan allocation needs the whole set, because a
 * monthly plan is shared across that client's visits in the same month.
 */
export function valueJobs<T extends ValuedJobInput>(jobs: T[]): Map<string, JobValue> {
  // Group the plan-covered visits by client and month, oldest first. Order
  // matters: with a declared visits-a-month, the earliest visits are the ones
  // the plan pays for and anything past that is extra.
  const buckets = new Map<string, T[]>();
  for (const j of jobs) {
    if (!j.clientId) continue;
    if (j.chargeAmount != null) continue; // explicitly priced, not drawing on the plan
    if (!isMonthly(j.client) || j.client?.planAmount == null) continue;
    const k = `${j.clientId}|${monthKeyOf(j.date)}`;
    const list = buckets.get(k);
    if (list) list.push(j);
    else buckets.set(k, [j]);
  }

  // Rank inside each bucket. Ties on date break by id so the ranking is stable
  // across renders and does not shuffle which visit is the paid one.
  const rank = new Map<string, number>();
  for (const list of buckets.values()) {
    list.sort((a, b) => a.date.getTime() - b.date.getTime() || a.id.localeCompare(b.id));
    list.forEach((j, i) => rank.set(j.id, i));
  }

  const out = new Map<string, JobValue>();
  for (const j of jobs) {
    const labor = num(j.laborCost);
    const minutes = jobMinutes(j);
    const base = { labor, minutes, profit: 0 };

    // 1. An explicit charge always wins.
    if (j.chargeAmount != null) {
      const value = num(j.chargeAmount);
      out.set(j.id, { ...base, value, kind: "charge", planSplit: 0, splitDeclared: false, profit: value - labor });
      continue;
    }

    const planAmount = j.client?.planAmount == null ? null : num(j.client.planAmount);

    // 2 and 4. Monthly plan: split it, and flag anything past the allowance.
    if (j.clientId && isMonthly(j.client) && planAmount != null) {
      const k = `${j.clientId}|${monthKeyOf(j.date)}`;
      const actual = buckets.get(k)?.length ?? 1;
      const declared = j.client?.visitsPerMonth ?? null;
      const splitDeclared = declared != null && declared > 0;
      const split = splitDeclared ? declared! : actual;
      const position = rank.get(j.id) ?? 0;

      if (position >= split) {
        out.set(j.id, { ...base, value: 0, kind: "over", planSplit: split, splitDeclared, profit: -labor });
        continue;
      }
      const value = planAmount / split;
      out.set(j.id, { ...base, value, kind: "plan", planSplit: split, splitDeclared, profit: value - labor });
      continue;
    }

    // 3. Off plan with a flat rate per visit.
    if (j.clientId && planAmount != null && planAmount > 0) {
      out.set(j.id, { ...base, value: planAmount, kind: "rate", planSplit: 0, splitDeclared: false, profit: planAmount - labor });
      continue;
    }

    // 4. No client, or a client with nothing set. Worth nothing until told.
    out.set(j.id, { ...base, value: 0, kind: "none", planSplit: 0, splitDeclared: false, profit: -labor });
  }
  return out;
}

/**
 * Kept as a re-export so callers have one import path for money-and-time on a
 * job. Formatting itself lives in lib/duration.ts.
 */
export { fmtDur } from "@/lib/duration";
