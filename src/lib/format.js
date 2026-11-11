// Display formatting shared by server and client. Business timezone: Asia/Karachi.

const TZ = "Asia/Karachi";

const dateFmt = new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeZone: TZ });
const dateTimeFmt = new Intl.DateTimeFormat("en-PK", { dateStyle: "medium", timeStyle: "short", timeZone: TZ });
const pkrFmt = new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 });
const relFmt = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

/** "Muhammad Ali Raza" -> "MA". */
export function initials(name) {
  const parts = String(name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts.length > 1 ? parts[1][0] : "")).toUpperCase();
}

export function formatDate(value) {
  return value ? dateFmt.format(new Date(value)) : "";
}

export function formatDateTime(value) {
  return value ? dateTimeFmt.format(new Date(value)) : "";
}

/** Money is integer PKR everywhere. 155000 -> "Rs 155,000". */
export function formatPKR(amount) {
  if (amount == null || Number.isNaN(Number(amount))) return "";
  return `Rs ${pkrFmt.format(amount)}`;
}

export function formatNumber(n) {
  return pkrFmt.format(n ?? 0);
}

/** "3 days ago", "yesterday", "in 2 hours". */
export function formatRelative(value, now = Date.now()) {
  if (!value) return "";
  const diffSec = Math.round((new Date(value).getTime() - now) / 1000);
  const abs = Math.abs(diffSec);
  if (abs < 60) return relFmt.format(diffSec, "second");
  if (abs < 3600) return relFmt.format(Math.round(diffSec / 60), "minute");
  if (abs < 86400) return relFmt.format(Math.round(diffSec / 3600), "hour");
  if (abs < 86400 * 30) return relFmt.format(Math.round(diffSec / 86400), "day");
  if (abs < 86400 * 365) return relFmt.format(Math.round(diffSec / (86400 * 30)), "month");
  return relFmt.format(Math.round(diffSec / (86400 * 365)), "year");
}
