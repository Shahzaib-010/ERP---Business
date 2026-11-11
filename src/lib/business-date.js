// Business dates (agreement date, due dates, payment dates) are calendar days, not moments.
// They are stored as a Date at 00:00 UTC of that calendar day, so "2026-09-01" always means
// 1 September whatever the server's timezone. "Today" is today's date in Pakistan (UTC+5).

const PK_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** "YYYY-MM-DD" for today in Pakistan. */
export function todayPk(now = new Date()) {
  return new Date(now.getTime() + PK_OFFSET_MS).toISOString().slice(0, 10);
}

/** "YYYY-MM-DD" -> Date at 00:00 UTC, or null if the string is not a real date. */
export function parseDateOnly(value) {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : toDateOnly(value);
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : d;
}

/** Strip the time part (keeps the UTC calendar day). */
export function toDateOnly(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Date -> "YYYY-MM-DD". */
export function dateOnlyString(date) {
  return date ? new Date(date).toISOString().slice(0, 10) : "";
}

export function addDays(date, days) {
  return new Date(date.getTime() + days * DAY_MS);
}

/** Whole days from a to b (b - a). */
export function daysBetween(a, b) {
  return Math.round((toDateOnly(b).getTime() - toDateOnly(a).getTime()) / DAY_MS);
}

/** Day `day` of the month that is `monthOffset` months after `date`. 31 -> last day of short months. */
export function monthDay(date, monthOffset, day) {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + monthOffset;
  const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(y, m, Math.min(day, last)));
}

const fmt = new Intl.DateTimeFormat("en-PK", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** Display a business date: "1 Sept 2026". */
export function formatBusinessDate(value) {
  return value ? fmt.format(new Date(value)) : "";
}
