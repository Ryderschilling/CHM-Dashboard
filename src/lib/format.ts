/** Convert Prisma Decimal (or anything) to a plain number. */
export function num(x: unknown): number {
  if (x == null) return 0;
  const n = Number(x);
  return Number.isFinite(n) ? n : 0;
}

/** $1,234 or $1,234.50 - drops cents when whole. */
export function money(x: unknown): string {
  const n = num(x);
  const whole = Math.abs(n % 1) < 0.005;
  return n.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: whole ? 0 : 2,
  });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The business runs on 30A. All display dates and times render Central. */
const TZ = "America/Chicago";

/** "Jul 30" this year, "Jul 30, 2025" otherwise. Rendered in Central time. */
export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  const year = Number(dt.toLocaleDateString("en-US", { timeZone: TZ, year: "numeric" }));
  const base = dt.toLocaleDateString("en-US", { timeZone: TZ, month: "short", day: "numeric" });
  return year === new Date().getFullYear() ? base : `${base}, ${year}`;
}

/** "Jul 2026" */
export function fmtMonth(d: Date): string {
  return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "2026-07" key for a date. */
export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** First day of month, offset months from now (0 = this month). */
export function monthStart(offset = 0): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + offset, 1);
}

/** yyyy-mm-dd for date inputs. */
export function toInputDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
}

export function todayInput(): string {
  return toInputDate(new Date());
}

/** "9:30 AM" in Central time. */
export function fmtTime(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" });
}

/** Days between now and a date, negative = past. */
export function daysUntil(d: Date | string): number {
  const dt = typeof d === "string" ? new Date(d) : d;
  const ms = dt.getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export function isOverdue(dueDate: Date | string | null | undefined): boolean {
  if (!dueDate) return false;
  const dt = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  return dt.getTime() < startOfToday.getTime();
}

/** Parse a "2026-08" query param into the first of that month. Falls back to now. */
export function parseMonthParam(m?: string): Date {
  if (m) {
    const match = m.match(/^(\d{4})-(\d{2})$/);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1, 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

/** "2026-08" for a month, for building links. */
export function monthParam(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
