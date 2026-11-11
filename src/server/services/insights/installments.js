import "server-only";
import { connectDB } from "@/server/db/mongoose";
import { Customer } from "@/server/models/Customer";
import { InstallmentPlan } from "@/server/models/InstallmentPlan";
import { Payment } from "@/server/models/Payment";
import { requirePermission } from "@/server/permissions";
import { periodRange } from "@/server/services/cashbook";
import { progressFromTotals } from "@/server/services/installments";
import { buildRows } from "@/lib/installment-schedule";
import { addDays, parseDateOnly, todayPk } from "@/lib/business-date";

// Statistics for the installment business (dashboard → Installments). Integer PKR.

const MONTH_FMT = new Intl.DateTimeFormat("en-PK", { month: "short", year: "2-digit", timeZone: "UTC" });
const KIND_LABELS = { bike: "Motorcycles", mobile: "Mobile phones", appliance: "Appliances", other: "Other items" };
const AGING = [
  { key: "on_time", label: "On time", test: (d) => d === 0 },
  { key: "d1_30", label: "1–30 days late", test: (d) => d >= 1 && d <= 30 },
  { key: "d31_60", label: "31–60 days late", test: (d) => d >= 31 && d <= 60 },
  { key: "d60p", label: "Over 60 days late", test: (d) => d > 60 },
];

function months12(today) {
  const t = parseDateOnly(today);
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - (11 - i), 1));
    return { key: d.toISOString().slice(0, 7), label: MONTH_FMT.format(d), start: d };
  });
}

const sumPayments = async (from, to) => {
  const [r] = await Payment.aggregate([
    { $match: { status: "posted", kind: { $in: ["advance", "installment"] }, paidAt: { $gte: from, $lt: to } } },
    { $group: { _id: null, s: { $sum: "$amount" }, n: { $sum: 1 } } },
  ]);
  return { sum: r?.s ?? 0, count: r?.n ?? 0 };
};

export async function getInstallmentInsights(actor, period = "month") {
  requirePermission(actor, "installments.view");
  await connectDB();
  const today = todayPk();
  const todayDate = parseDateOnly(today);
  const range = periodRange(period, today);
  const months = months12(today);
  const trendFrom = months[0].start;
  const trendTo = new Date(Date.UTC(todayDate.getUTCFullYear(), todayDate.getUTCMonth() + 1, 1));

  const [plans, collected, prevCollected, monthlyPaid] = await Promise.all([
    InstallmentPlan.find({ status: { $ne: "cancelled" } }).select("accountNumber customerId item terms schedule totals status completedAt").lean(),
    sumPayments(range.from, range.to),
    sumPayments(range.prevFrom, range.prevTo),
    Payment.aggregate([
      { $match: { status: "posted", kind: { $in: ["advance", "installment"] }, paidAt: { $gte: trendFrom } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$paidAt" } }, s: { $sum: "$amount" } } },
    ]).then((rows) => Object.fromEntries(rows.map((r) => [r._id, r.s]))),
  ]);

  const inRange = (d, from, to) => d && d >= from && d < to;
  const pkTime = (d) => new Date(d.getTime() + 5 * 3600e3); // timestamp -> Pakistan calendar day
  const active = plans.filter((p) => p.status === "active");

  // New and completed plans in the period (and the one before, for comparison).
  const newPlans = plans.filter((p) => inRange(p.terms.agreementDate, range.from, range.to));
  const prevNewPlans = plans.filter((p) => inRange(p.terms.agreementDate, range.prevFrom, range.prevTo));
  const completed = plans.filter((p) => p.completedAt && inRange(pkTime(p.completedAt), range.from, range.to)).length;

  // Expected (from each plan's own schedule) vs collected, per month.
  const expected = Object.fromEntries(months.map((m) => [m.key, 0]));
  const newByMonth = Object.fromEntries(months.map((m) => [m.key, { count: 0, value: 0 }]));
  for (const p of plans) {
    const rows = buildRows({ agreedTotal: p.terms.agreedTotal, advanceAmount: p.terms.advanceAmount ?? 0, agreementDate: p.terms.agreementDate, schedule: p.schedule });
    for (const r of rows) {
      if (r.dueDate >= trendFrom && r.dueDate < trendTo) expected[r.dueDate.toISOString().slice(0, 7)] += r.amount;
    }
    const k = p.terms.agreementDate.toISOString().slice(0, 7);
    if (newByMonth[k]) {
      newByMonth[k].count += 1;
      newByMonth[k].value += p.terms.agreedTotal;
    }
  }
  const trend = months.map((m) => ({
    month: m.key,
    label: m.label,
    expected: expected[m.key],
    collected: monthlyPaid[m.key] ?? 0,
    newPlans: newByMonth[m.key].count,
    newValue: newByMonth[m.key].value,
  }));

  // Receivables, lateness, upcoming dues.
  const aging = AGING.map((b) => ({ key: b.key, label: b.label, count: 0, balance: 0, overdue: 0 }));
  const byKind = {};
  let receivables = 0;
  let overdue = 0;
  const withProgress = active.map((p) => {
    const progress = progressFromTotals(p, today);
    const days = progress.overdue?.daysLate ?? 0;
    const b = aging[AGING.findIndex((x) => x.test(days))];
    b.count += 1;
    b.balance += p.totals.balance;
    b.overdue += progress.overdue?.amount ?? 0;
    receivables += p.totals.balance;
    overdue += progress.overdue?.amount ?? 0;
    const kind = byKind[p.item.kind] ?? (byKind[p.item.kind] = { key: p.item.kind, label: KIND_LABELS[p.item.kind] ?? "Other", value: 0, count: 0 });
    kind.value += p.totals.balance;
    kind.count += 1;
    return { plan: p, progress };
  });
  const horizon = addDays(todayDate, 30);
  const dueSoonRaw = withProgress
    .filter((x) => x.progress.nextDue && x.progress.nextDue.dueDate <= horizon)
    .sort((a, b) => a.progress.nextDue.dueDate - b.progress.nextDue.dueDate);
  const lateRaw = withProgress.filter((x) => x.progress.overdue).sort((a, b) => b.progress.overdue.daysLate - a.progress.overdue.daysLate);
  const topRaw = [...withProgress].sort((a, b) => b.plan.totals.balance - a.plan.totals.balance).slice(0, 5);

  const ids = [...new Set([...dueSoonRaw.slice(0, 8), ...lateRaw.slice(0, 8), ...topRaw].map((x) => String(x.plan.customerId)))];
  const customers = ids.length ? await Customer.find({ _id: { $in: ids } }).select("name phones").lean() : [];
  const cById = new Map(customers.map((c) => [String(c._id), c]));
  const row = ({ plan, progress }) => ({
    id: String(plan._id),
    accountNumber: plan.accountNumber,
    customer: cById.get(String(plan.customerId))?.name ?? "Customer",
    phone: cById.get(String(plan.customerId))?.phones?.[0] ?? null,
    item: plan.item.description,
    balance: plan.totals.balance,
    agreedTotal: plan.terms.agreedTotal,
    percent: progress.percent,
    nextDue: progress.nextDue,
    overdue: progress.overdue,
    status: plan.status,
  });

  const lateCount = lateRaw.length;
  return {
    period,
    range: { label: range.label },
    kpis: {
      collected: { value: collected.sum, previous: prevCollected.sum, count: collected.count },
      newPlans: { value: newPlans.length, previous: prevNewPlans.length, worth: newPlans.reduce((s, p) => s + p.terms.agreedTotal, 0) },
      completed,
      avgPlan: newPlans.length ? Math.round(newPlans.reduce((s, p) => s + p.terms.agreedTotal, 0) / newPlans.length) : 0,
    },
    position: {
      activePlans: active.length,
      receivables,
      overdue,
      lateCount,
      onTimeRate: active.length ? Math.round(((active.length - lateCount) / active.length) * 100) : 100,
      dueNext30: dueSoonRaw.reduce((s, x) => s + x.progress.nextDue.amount, 0),
      dueNext30Count: dueSoonRaw.length,
    },
    trend,
    aging,
    byKind: Object.values(byKind).sort((a, b) => b.value - a.value),
    dueSoon: dueSoonRaw.slice(0, 8).map(row),
    late: lateRaw.slice(0, 8).map(row),
    topBalances: topRaw.map(row),
  };
}
