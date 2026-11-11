import "server-only";
import mongoose from "mongoose";
import { connectDB, withTransaction } from "@/server/db/mongoose";
import { Bike } from "@/server/models/Bike";
import { Customer } from "@/server/models/Customer";
import { FinancialTransaction } from "@/server/models/FinancialTransaction";
import { InstallmentPlan } from "@/server/models/InstallmentPlan";
import { Payment } from "@/server/models/Payment";
import { SellerPayment } from "@/server/models/SellerPayment";
import { NotFoundError, ValidationError, parseOrThrow } from "@/server/errors";
import { requirePermission } from "@/server/permissions";
import { recordAudit } from "@/server/services/audit";
import { cashbookListSchema, transactionSchema, voidTransactionSchema } from "@/server/validation/cashbook";
import { ENTRY_TYPES, PERIODS, SOURCE_LABELS, categoryLabel } from "@/lib/cashbook";
import { parseDateOnly, todayPk } from "@/lib/business-date";

// Cash book (roadmap Phase 5, D-014). One ledger assembled from:
//   - installment advances and payments   (payments, posted, not discounts)  -> in
//   - cash bike sales                      (bikes.sale, mode "cash")          -> in
//   - payments to bike sellers             (sellerPayments, posted)           -> out
//   - expenses, other income, owner money  (financialTransactions, posted)    -> in / out
// Each real-world payment exists in exactly one place, so nothing is counted twice.
// Settlement discounts are not cash and never appear here.

export const CASHBOOK_PAGE_SIZE = 30;

// ---------- periods ----------

function monthStart(y, m) {
  return new Date(Date.UTC(y, m, 1));
}

/** [from, to) for a period, plus the equally long window before it. Business dates (UTC midnight). */
export function periodRange(period = "month", today = todayPk()) {
  const t = parseDateOnly(today);
  const y = t.getUTCFullYear();
  const m = t.getUTCMonth();
  const months = { month: 1, "3m": 3, "12m": 12 }[period];
  let from;
  let to;
  if (period === "year") {
    from = monthStart(y, 0);
    to = monthStart(y + 1, 0);
  } else {
    from = monthStart(y, m - (months - 1));
    to = monthStart(y, m + 1);
  }
  const span = period === "year" ? 12 : months;
  const prevFrom = monthStart(from.getUTCFullYear(), from.getUTCMonth() - span);
  const label = PERIODS.find((p) => p.value === period)?.label ?? period;
  return { from, to, prevFrom, prevTo: from, label, months: span };
}

// ---------- ledger ----------

function dateFilter(field, from, to) {
  const f = {};
  if (from) f.$gte = from;
  if (to) f.$lt = to;
  return Object.keys(f).length ? { [field]: f } : {};
}

/** Every cash movement in [from, to), newest first. */
export async function collectEntries({ from, to } = {}) {
  const [payments, sales, sellerPayments, manual] = await Promise.all([
    Payment.find({ status: "posted", kind: { $in: ["advance", "installment"] }, ...dateFilter("paidAt", from, to) }).lean(),
    Bike.find({ "sale.mode": "cash", ...dateFilter("sale.date", from, to) }).lean(),
    SellerPayment.find({ status: "posted", ...dateFilter("paidAt", from, to) }).lean(),
    FinancialTransaction.find({ status: "posted", ...dateFilter("occurredAt", from, to) }).lean(),
  ]);

  const planIds = [...new Set(payments.map((p) => String(p.planId)))];
  const plans = planIds.length ? await InstallmentPlan.find({ _id: { $in: planIds } }).select("accountNumber item.description").lean() : [];
  const planById = new Map(plans.map((p) => [String(p._id), p]));
  const customerIds = [...new Set([...payments.map((p) => String(p.customerId)), ...sales.map((b) => String(b.sale.customerId))])];
  const customers = customerIds.length ? await Customer.find({ _id: { $in: customerIds } }).select("name").lean() : [];
  const customerById = new Map(customers.map((c) => [String(c._id), c.name]));
  const bikeIds = [...new Set(sellerPayments.map((p) => String(p.bikeId)))];
  const bikes = bikeIds.length ? await Bike.find({ _id: { $in: bikeIds } }).select("bikeNumber make model purchase.seller.name").lean() : [];
  const bikeById = new Map(bikes.map((b) => [String(b._id), b]));

  const entries = [];
  for (const p of payments) {
    const plan = planById.get(String(p.planId));
    entries.push({
      id: `pay-${p._id}`,
      source: p.kind,
      direction: "in",
      amount: p.amount,
      date: p.paidAt,
      title: customerById.get(String(p.customerId)) ?? "Customer",
      detail: plan ? `#${plan.accountNumber} · ${plan.item.description}` : "",
      reference: p.receiptNumber ? `Receipt ${p.receiptNumber}` : null,
      href: `/plans/${p.planId}`,
      createdAt: p.createdAt,
    });
  }
  for (const b of sales) {
    entries.push({
      id: `sale-${b._id}`,
      source: "bike_cash_sale",
      direction: "in",
      amount: b.sale.price,
      date: b.sale.date,
      title: customerById.get(String(b.sale.customerId)) ?? "Customer",
      detail: `B-${b.bikeNumber} · ${b.make} ${b.model}`,
      reference: b.sale.receiptNumber ? `Receipt ${b.sale.receiptNumber}` : null,
      href: `/bikes/${b._id}`,
      createdAt: b.updatedAt,
    });
  }
  for (const p of sellerPayments) {
    const b = bikeById.get(String(p.bikeId));
    entries.push({
      id: `seller-${p._id}`,
      source: "seller_payment",
      direction: "out",
      amount: p.amount,
      date: p.paidAt,
      title: b?.purchase?.seller?.name ?? "Seller",
      detail: b ? `B-${b.bikeNumber} · ${b.make} ${b.model}` : "",
      reference: null,
      href: `/bikes/${p.bikeId}`,
      createdAt: p.createdAt,
    });
  }
  for (const t of manual) {
    entries.push({
      id: `txn-${t._id}`,
      transactionId: String(t._id),
      source: t.type,
      category: t.category ?? null,
      categoryLabel: categoryLabel(t.type, t.category),
      direction: ENTRY_TYPES[t.type].direction,
      amount: t.amount,
      date: t.occurredAt,
      title: t.description,
      detail: t.party ?? "",
      reference: t.voucherNumber ? `Voucher ${t.voucherNumber}` : null,
      href: null,
      createdAt: t.createdAt,
    });
  }
  return entries
    .map((e) => ({ ...e, sourceLabel: SOURCE_LABELS[e.source] }))
    .sort((a, b) => b.date - a.date || new Date(b.createdAt ?? 0) - new Date(a.createdAt ?? 0));
}

/** Sum of in/out for [from, to). Uses aggregation, not the full entry list. */
export async function cashTotals({ from, to } = {}) {
  const sum = async (Model, match, field = "$amount") => {
    const [r] = await Model.aggregate([{ $match: match }, { $group: { _id: null, s: { $sum: field } } }]);
    return r?.s ?? 0;
  };
  const [inPayments, inSales, outSeller, manual] = await Promise.all([
    sum(Payment, { status: "posted", kind: { $in: ["advance", "installment"] }, ...dateFilter("paidAt", from, to) }),
    sum(Bike, { "sale.mode": "cash", ...dateFilter("sale.date", from, to) }, "$sale.price"),
    sum(SellerPayment, { status: "posted", ...dateFilter("paidAt", from, to) }),
    FinancialTransaction.aggregate([{ $match: { status: "posted", ...dateFilter("occurredAt", from, to) } }, { $group: { _id: "$type", s: { $sum: "$amount" } } }]),
  ]);
  const byType = Object.fromEntries(manual.map((r) => [r._id, r.s]));
  const cashIn = inPayments + inSales + (byType.other_income ?? 0) + (byType.owner_investment ?? 0);
  const cashOut = outSeller + (byType.expense ?? 0) + (byType.owner_withdrawal ?? 0);
  return {
    cashIn,
    cashOut,
    net: cashIn - cashOut,
    parts: {
      installments: inPayments,
      bikeCashSales: inSales,
      otherIncome: byType.other_income ?? 0,
      ownerInvestment: byType.owner_investment ?? 0,
      sellerPayments: outSeller,
      expenses: byType.expense ?? 0,
      ownerWithdrawal: byType.owner_withdrawal ?? 0,
    },
  };
}

export async function listCashbook(actor, input = {}) {
  requirePermission(actor, "transactions.view");
  const { period, direction, page } = parseOrThrow(cashbookListSchema, input);
  await connectDB();
  const range = periodRange(period);
  const [all, totals, allTime] = await Promise.all([collectEntries(range), cashTotals(range), cashTotals({})]);
  const filtered = direction === "all" ? all : all.filter((e) => e.direction === direction);
  const pageCount = Math.max(1, Math.ceil(filtered.length / CASHBOOK_PAGE_SIZE));
  const current = Math.min(page, pageCount);
  return {
    period,
    direction,
    range: { from: range.from, to: range.to, label: range.label },
    totals,
    cashInHand: allTime.net,
    items: filtered.slice((current - 1) * CASHBOOK_PAGE_SIZE, current * CASHBOOK_PAGE_SIZE),
    total: filtered.length,
    page: current,
    pageCount,
  };
}

// ---------- manual entries ----------

export async function createTransaction(actor, input) {
  requirePermission(actor, "transactions.create");
  const data = parseOrThrow(transactionSchema, input);
  await connectDB();
  return withTransaction(async (session) => {
    const [t] = await FinancialTransaction.create([{ ...data, createdBy: actor.id }], { session });
    await recordAudit(
      {
        actor,
        action: "cashbook.create",
        entityType: "financialTransaction",
        entityId: t._id,
        after: { type: t.type, category: t.category ?? null, amount: t.amount, date: t.occurredAt, description: t.description },
      },
      session,
    );
    return { id: String(t._id) };
  });
}

export async function voidTransaction(actor, id, input) {
  requirePermission(actor, "transactions.edit");
  const { reason } = parseOrThrow(voidTransactionSchema, input);
  if (!mongoose.isValidObjectId(id)) throw new NotFoundError("Entry not found.");
  await connectDB();
  return withTransaction(async (session) => {
    const t = await FinancialTransaction.findById(id).session(session);
    if (!t) throw new NotFoundError("Entry not found.");
    if (t.status !== "posted") throw new ValidationError("This entry is already voided.", {});
    t.status = "voided";
    t.voidedAt = new Date();
    t.voidedBy = actor.id;
    t.voidReason = reason;
    await t.save({ session });
    await recordAudit(
      {
        actor,
        action: "cashbook.void",
        entityType: "financialTransaction",
        entityId: t._id,
        before: { type: t.type, amount: t.amount, date: t.occurredAt, description: t.description, status: "posted" },
        after: { status: "voided" },
        reason,
      },
      session,
    );
    return { ok: true };
  });
}
