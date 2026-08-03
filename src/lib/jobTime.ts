/**
 * How long the work actually takes, and what an hour of it is worth.
 *
 * Two ideas, kept separate on purpose:
 *
 *   Job.laborHours   what this specific visit really took. Measured.
 *   JobStandard      what this kind of visit normally takes. Estimated once,
 *                    then reused forever.
 *
 * Everything on the Time page runs on "effective hours" = the measured number
 * when there is one, otherwise the standard. A job with neither is not counted
 * as zero, it is counted as UNKNOWN and surfaced, because a silent zero is how
 * a business ends up believing it works fewer hours than it does.
 *
 * Money never changes here. lib/jobValue.ts still owns what a visit is worth.
 * This file only divides that value by time.
 */
import { num } from "@/lib/format";
import { valueJobs, type ValuedJobInput } from "@/lib/jobValue";

export type StandardLite = {
  id: string;
  label: string;
  minutes: number;
  gcalSeriesId: string | null;
  titleMatch: string | null;
  active: boolean;
  clientId: string | null;
};

export type TimedJobInput = ValuedJobInput & {
  title: string;
  gcalSeriesId?: string | null;
  status?: string;
};

export type HoursSource = "logged" | "standard" | "unknown";

export type JobTime = {
  hours: number | null;
  source: HoursSource;
  /** The standard that filled the gap, when one did. */
  standardId: string | null;
};

/**
 * Pick the standard that governs a job.
 *
 * Series id beats title text, always. Among title matches the longest pattern
 * wins, so a specific "Beth Tedesco Mail" beats a broad "Mail".
 */
export function matchStandard(
  job: { title: string; gcalSeriesId?: string | null; clientId: string | null },
  standards: StandardLite[],
): StandardLite | null {
  const live = standards.filter((s) => s.active);

  if (job.gcalSeriesId) {
    const bySeries = live.find((s) => s.gcalSeriesId === job.gcalSeriesId);
    if (bySeries) return bySeries;
  }

  const title = job.title.toLowerCase();
  const byTitle = live
    .filter((s) => s.titleMatch && title.includes(s.titleMatch.toLowerCase()))
    // A standard tied to this client is a better answer than a loose one.
    .sort((a, b) => {
      const own = Number(b.clientId === job.clientId) - Number(a.clientId === job.clientId);
      if (own !== 0) return own;
      return (b.titleMatch?.length ?? 0) - (a.titleMatch?.length ?? 0);
    })[0];

  return byTitle ?? null;
}

/** Effective hours for one job. */
export function jobTime(job: TimedJobInput, standards: StandardLite[]): JobTime {
  if (job.laborHours != null && num(job.laborHours) > 0) {
    return { hours: num(job.laborHours), source: "logged", standardId: null };
  }
  const std = matchStandard(job, standards);
  if (std) return { hours: std.minutes / 60, source: "standard", standardId: std.id };
  return { hours: null, source: "unknown", standardId: null };
}

/** Effective hours for a whole list, keyed by job id. */
export function timeJobs<T extends TimedJobInput>(
  jobs: T[],
  standards: StandardLite[],
): Map<string, JobTime> {
  const out = new Map<string, JobTime>();
  for (const j of jobs) out.set(j.id, jobTime(j, standards));
  return out;
}

/* ── Rollups ─────────────────────────────────────────────────────────────── */

export type ClientTimeRow = {
  clientId: string;
  name: string;
  visits: number;
  /** Visits we can put a number on. */
  timedVisits: number;
  hours: number;
  value: number;
  /** value / hours, null when we have no hours to divide by. */
  perHour: number | null;
  /** Average minutes per visit across the visits we can time. */
  avgMinutes: number | null;
  /** True when at least one visit had no measured time and no standard. */
  incomplete: boolean;
};

/**
 * Dollars per hour, per client, over whatever set of jobs you hand it.
 *
 * Pass the WHOLE month's jobs. valueJobs splits a monthly plan across that
 * client's visits in the same month, so a filtered list would inflate the
 * per-visit value of everyone on a retainer.
 */
export function clientTimeRows<T extends TimedJobInput & { client?: { name?: string } | null }>(
  jobs: T[],
  standards: StandardLite[],
): ClientTimeRow[] {
  const values = valueJobs(jobs);
  const times = timeJobs(jobs, standards);
  const rows = new Map<string, ClientTimeRow>();

  for (const j of jobs) {
    if (!j.clientId) continue;
    const row =
      rows.get(j.clientId) ??
      {
        clientId: j.clientId,
        name: j.client?.name ?? "Unnamed",
        visits: 0,
        timedVisits: 0,
        hours: 0,
        value: 0,
        perHour: null,
        avgMinutes: null,
        incomplete: false,
      };

    const t = times.get(j.id);
    row.visits += 1;
    row.value += values.get(j.id)?.value ?? 0;
    if (t?.hours != null) {
      row.hours += t.hours;
      row.timedVisits += 1;
    } else {
      row.incomplete = true;
    }
    rows.set(j.clientId, row);
  }

  for (const row of rows.values()) {
    row.perHour = row.hours > 0 ? row.value / row.hours : null;
    row.avgMinutes = row.timedVisits > 0 ? (row.hours / row.timedVisits) * 60 : null;
  }

  return [...rows.values()];
}

/** Total effective hours across a set of jobs, ignoring the unknowns. */
export function totalHours(jobs: TimedJobInput[], standards: StandardLite[]): number {
  const times = timeJobs(jobs, standards);
  let sum = 0;
  for (const j of jobs) sum += times.get(j.id)?.hours ?? 0;
  return sum;
}

/**
 * Typical hours on each weekday, averaged over the window.
 *
 * `weeks` is how many weeks of jobs went in, so Tuesday reads as "a normal
 * Tuesday costs me 3.5 hours" rather than "the next four Tuesdays total 14".
 */
export function weekdayLoad(
  jobs: TimedJobInput[],
  standards: StandardLite[],
  weeks: number,
): { day: number; hours: number; visits: number }[] {
  const times = timeJobs(jobs, standards);
  const buckets = Array.from({ length: 7 }, (_, day) => ({ day, hours: 0, visits: 0 }));
  for (const j of jobs) {
    const b = buckets[j.date.getDay()];
    b.hours += times.get(j.id)?.hours ?? 0;
    b.visits += 1;
  }
  const divisor = Math.max(1, weeks);
  return buckets.map((b) => ({ day: b.day, hours: b.hours / divisor, visits: b.visits / divisor }));
}

/** "15m", "1h 30m", "2h". Mirrors fmtHours but takes minutes. */
export function fmtMinutes(m: number | null | undefined): string {
  if (m == null || m <= 0) return "";
  const whole = Math.floor(m / 60);
  const mins = Math.round(m % 60);
  if (whole && mins) return `${whole}h ${mins}m`;
  if (whole) return `${whole}h`;
  return `${mins}m`;
}

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
