/**
 * One unit for time across the whole platform: WHOLE MINUTES.
 *
 * Every other time field already worked in minutes (JobStandard.minutes,
 * VisitReport.minutesOnSite). Job time was the odd one out: a Decimal(6,2)
 * of hours, which is why a box could only step 0.25 and why a 5 minute job
 * had to be written as 0.08. Minutes fixes both. Nothing rounds, nothing
 * drifts when you add a month of visits together.
 *
 * Hours still exist, but only as a derived number for rate math. They are
 * never stored and never shown as a decimal.
 */

/** Minutes to hours, for $/hr style math only. */
export function toHours(minutes: number | null | undefined): number | null {
  if (minutes == null) return null;
  return minutes / 60;
}

/** "45m", "1h 30m", "2h". Empty string when there is nothing to show. */
export function fmtDur(minutes: number | null | undefined): string {
  if (minutes == null) return "";
  const m = Math.round(minutes);
  if (m <= 0) return "";
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h && rest) return `${h}h ${rest}m`;
  if (h) return `${h}h`;
  return `${rest}m`;
}

/**
 * Read a duration the way a person would type it. Returns whole minutes.
 *
 *   "45"        -> 45      a bare whole number is minutes
 *   "5"         -> 5       so short jobs need no special syntax
 *   "45m"       -> 45
 *   "90 min"    -> 90
 *   "1h30"      -> 90
 *   "1h 30m"    -> 90
 *   "1:30"      -> 90
 *   "2h"        -> 120
 *   "2 hours"   -> 120
 *   "1.5"       -> 90      a bare DECIMAL is hours, because 1.5 minutes is
 *                          never what anybody means
 *   "1.5h"      -> 90
 *   ""          -> null    blank means "nobody timed this", not zero
 */
export function parseDuration(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;

  // 1:30 and 1:05
  const clock = s.match(/^(\d+)\s*:\s*([0-5]?\d)$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);

  // Anything with an h or an m in it: add up every piece it finds.
  if (/[hm]/.test(s)) {
    let total = 0;
    let matched = false;
    const hrs = s.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hrs|hour|hours)/);
    if (hrs) {
      total += Number(hrs[1]) * 60;
      matched = true;
    }
    // Minutes: either after the hours part, or the only thing there.
    const after = hrs ? s.slice(s.indexOf(hrs[0]) + hrs[0].length) : s;
    const mins = after.match(/(\d+(?:\.\d+)?)\s*(?:m|min|mins|minute|minutes)?/);
    if (mins && mins[1] !== undefined && mins[0].trim() !== "") {
      total += Number(mins[1]);
      matched = true;
    }
    if (!matched) return null;
    const out = Math.round(total);
    return Number.isFinite(out) && out >= 0 ? out : null;
  }

  // Bare number. A decimal means hours, a whole number means minutes.
  const n = Number(s);
  if (!Number.isFinite(n) || n < 0) return null;
  const out = s.includes(".") ? Math.round(n * 60) : Math.round(n);
  return out;
}

/**
 * The one place that decides how long a job took.
 *
 * `laborMinutes` is the real column. `laborHours` is the old decimal column,
 * read only, so nothing looks empty if the backfill has not run yet. Once
 * every row has minutes the old column can be dropped from the schema.
 */
export function jobMinutes(job: {
  laborMinutes?: number | null;
  laborHours?: unknown;
}): number | null {
  if (job.laborMinutes != null && job.laborMinutes > 0) return job.laborMinutes;
  const legacy = job.laborHours == null ? 0 : Number(job.laborHours);
  if (Number.isFinite(legacy) && legacy > 0) return Math.round(legacy * 60);
  return null;
}

/** Minutes for a form field, parsed the smart way. Blank stays null. */
export function minutesFrom(fd: FormData, key: string): number | null {
  const v = fd.get(key);
  if (typeof v !== "string") return null;
  return parseDuration(v);
}
