import "server-only";
import { connectDB } from "@/server/db/mongoose";
import { Bike } from "@/server/models/Bike";
import { Customer } from "@/server/models/Customer";
import { FinancialTransaction } from "@/server/models/FinancialTransaction";
import { InstallmentPlan } from "@/server/models/InstallmentPlan";
import { Payment } from "@/server/models/Payment";
import { SellerPayment } from "@/server/models/SellerPayment";
import { requirePermission } from "@/server/permissions";
import { cashTotals, periodRange } from "@/server/services/cashbook";
import { progressFromTotals } from "@/server/services/installments";
import { EXPENSE_CATEGORIES } from "@/lib/cashbook";
import { parseDateOnly, todayPk } from "@/lib/business-date";

// Business overview for the dashboard (roadmap Phase 5). All money is integer PKR.
//  - Sales: recognised when the sale is made (cash bike sale price, or a plan's total price on
//    its agreement date). Later installments are cash received, not new sales (doc 04 §5).
//  - Cash in/out: from the cash book sources (see services/cashbook).
//  - Receivables: balances of active plans. Payables: amounts owed to bike sellers.

const MONTH_FMT = new Intl.DateTimeFormat("en-PK", { month: "short", year: "2-digit", timeZone: "UTC" });

function monthKeys(count, today = todayPk()) {
  const t = parseDateOnly(today);
  const out = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - i, 1));
    out.push({ key: d.toISOString().slice(0, 7), label: MONTH_FMT.format(d), start: d });
  }
  return out;
}

/** { "2026-10": sum } for a collection, grouped by month of a date field. */
async function monthly(Model, match, dateField, sumField = "$amount") {
  const rows = await Model.aggregate([
    { $match: match },
    { $group: { _id: { $dateToString: { format: "%Y-%m", date: `$${dateField}` } }, s: { $sum: sumField } } },
  ]);
  return Object.fromEntries(rows.map((r) => [r._id, r.s]));
}

async function salesTotals(from, to) {
  const [plans, cash] = await Promise.all([
    InstallmentPlan.aggregate([
      { $match: { status: { $ne: "cancelled" }, "terms.agreementDate": { $gte: from, $lt: to } } },
      { $group: { _id: null, s: { $sum: "$terms.agreedTotal" }, n: { $sum: 1 } } },
    ]),
    Bike.aggregate([{ $match: { "sale.mode": "cash", "sale.date": { $gte: from, $lt: to } } }, { $group: { _id: null, s: { $sum: "$sale.price" }, n: { $sum: 1 } } }]),
  ]);
  return {
    total: (plans[0]?.s ?? 0) + (cash[0]?.s ?? 0),
    installment: plans[0]?.s ?? 0,
    cash: cash[0]?.s ?? 0,
    plansCount: plans[0]?.n ?? 0,
    cashSalesCount: cash[0]?.n ?? 0,
  };
}

const AGING = [
  { key: "on_time", label: "On time", test: (d) => d === 0 },
  { key: "d1_30", label: "1–30 days late", test: (d) => d >= 1 && d <= 30 },
  { key: "d31_60", label: "31–60 days late", test: (d) => d >= 31 && d <= 60 },
  { key: "d60p", label: "Over 60 days late", test: (d) => d > 60 },
];

export async function getFinanceOverview(actor, period = "month") {
  requirePermission(actor, "dashboard.view");
  await connectDB();
  const today = todayPk();
  const range = periodRange(period, today);
  const months = monthKeys(12, today);
  const trendFrom = months[0].start;

  const [current, previous, sales, prevSales, allTime, activePlans, owed, stock, newCustomers, prevCustomers, bikesSold] = await Promise.all([
    cashTotals(range),
    cashTotals({ from: range.prevFrom, to: range.prevTo }),
    salesTotals(range.from, range.to),
    salesTotals(range.prevFrom, range.prevTo),
    cashTotals({}),
    InstallmentPlan.find({ status: "active" }).select("terms schedule totals status").lean(),
    Bike.aggregate([{ $match: { "purchaseTotals.payable": { $gt: 0 } } }, { $group: { _id: null, s: { $sum: "$purchaseTotals.payable" }, n: { $sum: 1 } } }]),
    Bike.aggregate([{ $match: { status: "in_stock" } }, { $group: { _id: null, s: { $sum: "$purchase.price" }, n: { $sum: 1 } } }]),
    Customer.countDocuments({ createdAt: { $gte: new Date(range.from.getTime() - 5 * 3600e3), $lt: new Date(range.to.getTime() - 5 * 3600e3) } }),
    Customer.countDocuments({ createdAt: { $gte: new Date(range.prevFrom.getTime() - 5 * 3600e3), $lt: new Date(range.prevTo.getTime() - 5 * 3600e3) } }),
    Bike.countDocuments({ status: "sold", "sale.date": { $gte: range.from, $lt: range.to } }),
  ]);

  // Receivables and how late they are.
  const aging = AGING.map((b) => ({ key: b.key, label: b.label, count: 0, balance: 0, overdue: 0 }));
  let receivables = 0;
  let overdueTotal = 0;
  for (const plan of activePlans) {
    const p = progressFromTotals(plan, today);
    const days = p.overdue?.daysLate ?? 0;
    const bucket = aging[AGING.findIndex((b) => b.test(days))];
    bucket.count += 1;
    bucket.balance += plan.totals?.balance ?? 0;
    bucket.overdue += p.overdue?.amount ?? 0;
    receivables += plan.totals?.balance ?? 0;
    overdueTotal += p.overdue?.amount ?? 0;
  }

  // 12-month trends.
  const trendMatch = (field) => ({ [field]: { $gte: trendFrom } });
  const [mPayments, mCashSales, mSeller, mManual, mPlans] = await Promise.all([
    monthly(Payment, { status: "posted", kind: { $in: ["advance", "installment"] }, ...trendMatch("paidAt") }, "paidAt"),
    monthly(Bike, { "sale.mode": "cash", ...trendMatch("sale.date") }, "sale.date", "$sale.price"),
    monthly(SellerPayment, { status: "posted", ...trendMatch("paidAt") }, "paidAt"),
    FinancialTransaction.aggregate([
      { $match: { status: "posted", ...trendMatch("occurredAt") } },
      { $group: { _id: { m: { $dateToString: { format: "%Y-%m", date: "$occurredAt" } }, t: "$type" }, s: { $sum: "$amount" } } },
    ]),
    monthly(InstallmentPlan, { status: { $ne: "cancelled" }, ...trendMatch("terms.agreementDate") }, "terms.agreementDate", "$terms.agreedTotal"),
  ]);
  const manualBy = (m, types) => mManual.filter((r) => r._id.m === m && types.includes(r._id.t)).reduce((s, r) => s + r.s, 0);
  const trend = months.map(({ key, label }) => ({
    month: key,
    label,
    cashIn: (mPayments[key] ?? 0) + (mCashSales[key] ?? 0) + manualBy(key, ["other_income", "owner_investment"]),
    cashOut: (mSeller[key] ?? 0) + manualBy(key, ["expense", "owner_withdrawal"]),
    collections: mPayments[key] ?? 0,
    salesInstallment: mPlans[key] ?? 0,
    salesCash: mCashSales[key] ?? 0,
  }));

  // Where money came from and went, in the selected period.
  const expenseRows = await FinancialTransaction.aggregate([
    { $match: { status: "posted", type: "expense", occurredAt: { $gte: range.from, $lt: range.to } } },
    { $group: { _id: "$category", s: { $sum: "$amount" } } },
  ]);
  const moneyIn = [
    { key: "installments", label: "Installments & advances", value: current.parts.installments },
    { key: "bikeCashSales", label: "Bike sales (cash)", value: current.parts.bikeCashSales },
    { key: "otherIncome", label: "Other income", value: current.parts.otherIncome },
    { key: "ownerInvestment", label: "Owner investment", value: current.parts.ownerInvestment },
  ].sort((a, b) => b.value - a.value);
  const moneyOut = [
    { key: "sellerPayments", label: "Bike purchases (paid to sellers)", value: current.parts.sellerPayments },
    ...expenseRows.map((r) => ({ key: `exp-${r._id}`, label: EXPENSE_CATEGORIES.find((c) => c.value === r._id)?.label ?? "Other", value: r.s })),
    { key: "ownerWithdrawal", label: "Owner withdrawal", value: current.parts.ownerWithdrawal },
  ]
    .filter((x) => x.value > 0)
    .sort((a, b) => b.value - a.value);

  return {
    period,
    range: { from: range.from, to: range.to, label: range.label },
    kpis: {
      cashIn: { value: current.cashIn, previous: previous.cashIn },
      cashOut: { value: current.cashOut, previous: previous.cashOut },
      net: { value: current.net, previous: previous.net },
      sales: { value: sales.total, previous: prevSales.total, cash: sales.cash, installment: sales.installment, count: sales.plansCount + sales.cashSalesCount },
      newCustomers: { value: newCustomers, previous: prevCustomers },
      bikesSold,
    },
    position: {
      cashInHand: allTime.net,
      receivables,
      overdue: overdueTotal,
      activePlans: activePlans.length,
      payables: owed[0]?.s ?? 0,
      payableBikes: owed[0]?.n ?? 0,
      stockValue: stock[0]?.s ?? 0,
      stockCount: stock[0]?.n ?? 0,
    },
    trend,
    moneyIn,
    moneyOut,
    aging,
  };
}
