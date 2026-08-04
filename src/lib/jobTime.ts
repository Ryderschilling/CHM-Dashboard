/**
 * How long the work actually takes, and what an hour of it is worth.
 *
 * Two ideas, kept separate on purpose:
 *
 *   Job.laborMinutes what this specific visit really took. Measured, in
 *                    whole minutes.
 *   JobStandard      what this kind of visit normally takes. Estimated once,
 *                    then reused forever.
 *
 * Everything on the Time page runs on "effective minutes" = the measured one
 * when there is one, otherwise the standard. A job with neither is not counted
 * as zero, it is counted as UNKNOWN and surfaced, because a silent zero is how
 * a business ends up believing it works fewer hours than it does.
 *
 * Money never changes here. lib/jobValue.ts still owns what a visit is worth.
 * This file only divides that value by time.
 */
import { jobMinutes } from "@/lib/duration";
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
  /** Whole minutes. Null means neither a measurement nor a standard. */
  minutes: number | null;
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

/** Effective minutes for one job. */
export function jobTime(job: TimedJobInput, standards: StandardLite[]): JobTime {
  const measured = jobMinutes(job);
  if (measured != null) return { minutes: measured, source: "logged", standardId: null };
  const std = matchStandard(job, standards);
  if (std) return { minutes: std.minutes, source: "standard", standardId: std.id };
  return { minutes: null, source: "unknown", standardId: null };
}

/** Effective minutes for a whole list, keyed by job id. */
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
  /** Total whole minutes across the timed visits. */
  minutes: number;
  value: number;
  /** value per hour, null when we have no time to divide by. */
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
        minutes: 0,
        value: 0,
        perHour: null,
        avgMinutes: null,
        incomplete: false,
      };

    const t = times.get(j.id);
    row.visits += 1;
    row.value += values.get(j.id)?.value ?? 0;
    if (t?.minutes != null) {
      row.minutes += t.minutes;
      row.timedVisits += 1;
    } else {
      row.incomplete = true;
    }
    rows.set(j.clientId, row);
  }

  for (const row of rows.values()) {
    row.perHour = row.minutes > 0 ? row.value / (row.minutes / 60) : null;
    row.avgMinutes = row.timedVisits > 0 ? row.minutes / row.timedVisits : null;
  }

  return [...rows.values()];
}

/** Total effective minutes across a set of jobs, ignoring the unknowns. */
export function totalMinutes(jobs: TimedJobInput[], standards: StandardLite[]): number {
  const times = timeJobs(jobs, standards);
  let sum = 0;
  for (const j of jobs) sum += times.get(j.id)?.minutes ?? 0;
  return sum;
}

/**
 * Typical minutes on each weekday, averaged over the window.
 *
 * `weeks` is how many weeks of jobs went in, so Tuesday reads as "a normal
 * Tuesday costs me 3h 30m" rather than "the next four Tuesdays total 14h".
 */
export function weekdayLoad(
  jobs: TimedJobInput[],
  standards: StandardLite[],
  weeks: number,
): { day: number; minutes: number; visits: number }[] {
  const times = timeJobs(jobs, standards);
  const buckets = Array.from({ length: 7 }, (_, day) => ({ day, minutes: 0, visits: 0 }));
  for (const j of jobs) {
    const b = buckets[j.date.getDay()];
    b.minutes += times.get(j.id)?.minutes ?? 0;
    b.visits += 1;
  }
  const divisor = Math.max(1, weeks);
  return buckets.map((b) => ({
    day: b.day,
    minutes: b.minutes / divisor,
    visits: b.visits / divisor,
  }));
}

/** Re-export so the Time page has one import for its numbers and its labels. */
export { fmtDur } from "@/lib/duration";

export const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
