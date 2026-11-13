import "server-only";
import mongoose from "mongoose";
import { connectDB, withTransaction } from "@/server/db/mongoose";
import { Bike } from "@/server/models/Bike";
import { Customer } from "@/server/models/Customer";
import { FinancialTransaction } from "@/server/models/FinancialTransaction";
import { InstallmentPlan } from "@/server/models/InstallmentPlan";
import { Payment } from "@/server/models/Payment";
import { StaffUser } from "@/server/models/StaffUser";
import { AppError, ConflictError, ForbiddenError, NotFoundError, ValidationError, parseOrThrow } from "@/server/errors";
import { can, requirePermission, requireStaffActor } from "@/server/permissions";
import { recordAudit } from "@/server/services/audit";
import { ACCOUNT, RECEIPT, allocateNumber, bumpNumber, claimReceiptNumber, peekNumber } from "@/server/services/numbering";
import {
  createPlanSchema,
  discountSchema,
  paymentSchema,
  planListSchema,
  scheduleSchema,
  updatePlanDetailsSchema,
  voidSchema,
} from "@/server/validation/installments";
import { computeProgress } from "@/lib/installment-schedule";
import { parseDateOnly, todayPk } from "@/lib/business-date";
import { maskCnic } from "@/lib/cnic";

// Installment plans and their payments (roadmap Phase 4).
// Plans and payments are never deleted. A wrong payment is voided with a reason; a plan's
// cached totals are always recomputed from its posted payments, never patched by hand.

export const PLAN_PAGE_SIZE = 25;

// ---------- numbering ----------

export async function getNextNumbers(actor) {
  requireStaffActor(actor);
  await connectDB();
  const [accountNumber, receiptNumber] = await Promise.all([peekNumber(ACCOUNT), peekNumber(RECEIPT)]);
  return { accountNumber, receiptNumber };
}

// ---------- helpers ----------

function assertObjectId(id, what = "Plan") {
  if (!mongoose.isValidObjectId(id)) throw new NotFoundError(`${what} not found.`);
}

function duplicateKey(err) {
  if (err?.code !== 11000) return null;
  return Object.keys(err.keyPattern ?? err.keyValue ?? {})[0] ?? "unknown";
}

function rethrowDuplicate(err, { accountNumber, receiptNumber } = {}) {
  const key = duplicateKey(err);
  if (key === "accountNumber") {
    throw new ConflictError(`Account number ${accountNumber ?? ""} is already used.`.replace("  ", " "), {
      accountNumber: "Already used by another plan.",
    });
  }
  if (key === "receiptNumber") {
    throw new ConflictError(`Receipt number ${receiptNumber ?? ""} is already used.`.replace("  ", " "), {
      receiptNumber: "Already used by another payment.",
      advanceReceiptNumber: "Already used by another payment.",
    });
  }
  throw err;
}

/** Totals from posted payments; marks the plan completed or active again. */
async function recomputePlan(plan, session) {
  const rows = await Payment.aggregate([
    { $match: { planId: plan._id, status: "posted" } },
    { $group: { _id: "$kind", sum: { $sum: "$amount" }, last: { $max: "$paidAt" } } },
  ]).session(session);
  let cash = 0;
  let discount = 0;
  let last = null;
  for (const r of rows) {
    if (r._id === "discount") discount += r.sum;
    else {
      cash += r.sum;
      if (!last || r.last > last) last = r.last;
    }
  }
  const balance = plan.terms.agreedTotal - cash - discount;
  if (balance < 0) throw new AppError("Payments would exceed the agreed total.", { code: "OVERPAID" });

  plan.totals = { cashReceived: cash, discount, balance, lastPaymentAt: last ?? undefined };
  if (balance === 0 && plan.status === "active") {
    plan.status = "completed";
    plan.completedAt = new Date();
  } else if (balance > 0 && plan.status === "completed") {
    plan.status = "active";
    plan.completedAt = undefined;
  }
  await plan.save({ session });
}

function planForSchedule(plan) {
  return {
    agreedTotal: plan.terms.agreedTotal,
    advanceAmount: plan.terms.advanceAmount ?? 0,
    agreementDate: plan.terms.agreementDate,
    schedule: plan.schedule,
    status: plan.status,
  };
}

/** Progress from cached totals (enough for lists and the dashboard). */
export function progressFromTotals(plan, today = todayPk()) {
  const synthetic = [
    { kind: "installment", amount: plan.totals?.cashReceived ?? 0 },
    { kind: "discount", amount: plan.totals?.discount ?? 0 },
  ];
  return computeProgress(planForSchedule(plan), synthetic, today);
}

function scheduleOut(s) {
  if (!s) return null;
  return {
    frequency: s.frequency,
    intervalDays: s.intervalDays ?? null,
    dueDayOfMonth: s.dueDayOfMonth ?? null,
    installmentAmount: s.installmentAmount ?? null,
    firstDueDate: s.firstDueDate ?? null,
  };
}

function summary(plan, customer, today) {
  const p = progressFromTotals(plan, today);
  return {
    id: String(plan._id),
    accountNumber: plan.accountNumber,
    previousAccountNumber: plan.previousAccountNumber ?? null,
    customer: customer ? { id: String(customer._id), name: customer.name } : null,
    item: { kind: plan.item.kind, description: plan.item.description, model: plan.item.model ?? "" },
    agreementDate: plan.terms.agreementDate,
    agreedTotal: plan.terms.agreedTotal,
    cashReceived: plan.totals?.cashReceived ?? 0,
    discount: plan.totals?.discount ?? 0,
    balance: plan.totals?.balance ?? plan.terms.agreedTotal,
    percent: p.percent,
    status: plan.status,
    overdue: p.overdue,
    nextDue: p.nextDue,
    installmentAmount: plan.schedule?.installmentAmount ?? null,
    lastPaymentAt: plan.totals?.lastPaymentAt ?? null,
  };
}

function auditPlan(plan) {
  return {
    accountNumber: plan.accountNumber,
    previousAccountNumber: plan.previousAccountNumber ?? null,
    item: plan.item?.description,
    agreedTotal: plan.terms.agreedTotal,
    advanceAmount: plan.terms.advanceAmount ?? 0,
    itemCost: plan.itemCost ?? null,
    schedule: scheduleOut(plan.schedule),
    guarantors: (plan.guarantors ?? []).map((g) => g.name),
    notes: plan.notes ?? null,
  };
}

/**
 * D-019: what the item cost and the profit on this sale. Cost is the bike's purchase price
 * for a bike from the register, otherwise the cost typed on the plan (null = not entered).
 */
function planProfit(plan, bike, costEntry) {
  const fromBike = Boolean(plan.relatedBikeId);
  const cost = fromBike ? (bike?.purchase?.price ?? null) : (plan.itemCost ?? null);
  const discount = plan.totals?.discount ?? 0;
  return {
    cost,
    costSource: fromBike ? "bike" : "plan",
    discount,
    profit: cost === null ? null : plan.terms.agreedTotal - discount - cost,
    paidFromCash: costEntry ? { amount: costEntry.amount, date: costEntry.occurredAt } : null,
  };
}

/** D-019: cash paid for a plan's item, as a cash book row linked to the plan. */
async function recordItemPurchase(actor, plan, session) {
  const [t] = await FinancialTransaction.create(
    [
      {
        type: "item_purchase",
        planId: plan._id,
        amount: plan.itemCost,
        occurredAt: plan.terms.agreementDate,
        description: `Bought for plan #${plan.accountNumber}: ${plan.item.description}`.slice(0, 300),
        createdBy: actor.id,
      },
    ],
    { session },
  );
  await recordAudit(
    {
      actor,
      action: "cashbook.create",
      entityType: "financialTransaction",
      entityId: t._id,
      after: { type: t.type, amount: t.amount, date: t.occurredAt, description: t.description, accountNumber: plan.accountNumber },
    },
    session,
  );
  return t;
}

function guarantorDocs(list) {
  return (list ?? []).map((g) => ({
    name: g.name,
    fatherName: g.fatherName,
    cnicNormalized: g.cnic,
    profession: g.profession,
    address: g.address,
    phones: g.phone ? [g.phone] : [],
  }));
}

async function loadPlan(id, session) {
  assertObjectId(id);
  const plan = await InstallmentPlan.findById(id).session(session ?? null);
  if (!plan) throw new NotFoundError("Plan not found.");
  return plan;
}

// ---------- create ----------

export async function createPlan(actor, input) {
  requirePermission(actor, "installments.create");
  // Recording the advance is part of creating the plan, so installments.create covers it.
  const data = parseOrThrow(createPlanSchema, input);
  assertObjectId(data.customerId, "Customer");
  await connectDB();

  try {
    return await withTransaction(async (session) => {
      const customer = await Customer.findById(data.customerId).session(session);
      if (!customer) throw new ValidationError(undefined, { customerId: "Customer not found." });

      // Selling a bike from the register on installments (Phase 3).
      let bike = null;
      if (data.relatedBikeId) {
        if (!can(actor, "bikes.create")) throw new ForbiddenError("You need permission to record bike sales.");
        assertObjectId(data.relatedBikeId, "Bike");
        bike = await Bike.findById(data.relatedBikeId).session(session);
        if (!bike) throw new ValidationError(undefined, { relatedBikeId: "Bike not found." });
        if (bike.status !== "in_stock") throw new ValidationError("This bike has already been sold.", { relatedBikeId: "Already sold." });
      }

      let accountNumber = data.accountNumber;
      if (accountNumber) await bumpNumber(ACCOUNT, accountNumber, session);
      else accountNumber = await allocateNumber(ACCOUNT, session);

      const [plan] = await InstallmentPlan.create(
        [
          {
            accountNumber,
            previousAccountNumber: data.previousAccountNumber,
            customerId: customer._id,
            item: { kind: data.itemKind, description: data.itemDescription, model: data.itemModel, serialNumber: data.itemSerial },
            terms: {
              agreementDate: data.agreementDate,
              cashPrice: data.cashPrice,
              agreedTotal: data.agreedTotal,
              advanceAmount: data.advanceAmount,
              schedule: data.schedule,
            },
            schedule: data.schedule,
            guarantors: guarantorDocs(data.guarantors),
            notes: data.notes,
            relatedBikeId: bike?._id,
            itemCost: bike ? undefined : data.itemCost,
            totals: { cashReceived: 0, discount: 0, balance: data.agreedTotal },
            createdBy: actor.id,
          },
        ],
        { session },
      );

      if (bike) {
        bike.status = "sold";
        bike.sale = {
          mode: "installment",
          date: data.agreementDate,
          customerId: customer._id,
          price: data.agreedTotal,
          cashPrice: data.cashPrice,
          planId: plan._id,
          soldBy: actor.id,
        };
        await bike.save({ session });
        await recordAudit(
          {
            actor,
            action: "bike.sell_installment",
            entityType: "bike",
            entityId: bike._id,
            after: { customer: customer.name, accountNumber: plan.accountNumber, price: data.agreedTotal },
          },
          session,
        );
      }

      if (data.advanceAmount > 0) {
        if (data.advanceReceiptNumber) await claimReceiptNumber(data.advanceReceiptNumber, session, "advanceReceiptNumber");
        await Payment.create(
          [
            {
              planId: plan._id,
              customerId: customer._id,
              kind: "advance",
              amount: data.advanceAmount,
              paidAt: data.agreementDate,
              receiptNumber: data.advanceReceiptNumber,
              enteredBy: actor.id,
            },
          ],
          { session },
        );
      }
      await recomputePlan(plan, session);
      // Paying for the item is part of setting up the sale, like the advance (D-019).
      if (!bike && data.itemCostPaidFromCash && plan.itemCost) await recordItemPurchase(actor, plan, session);

      await recordAudit(
        { actor, action: "plan.create", entityType: "installmentPlan", entityId: plan._id, after: auditPlan(plan) },
        session,
      );
      await recordAudit(
        {
          actor,
          action: "plan.create",
          entityType: "customer",
          entityId: customer._id,
          after: { accountNumber: plan.accountNumber, item: plan.item.description, agreedTotal: plan.terms.agreedTotal },
        },
        session,
      );
      return { id: String(plan._id), accountNumber: plan.accountNumber };
    });
  } catch (err) {
    rethrowDuplicate(err, { accountNumber: data.accountNumber, receiptNumber: data.advanceReceiptNumber });
  }
}

// ---------- read ----------

export async function listPlans(actor, input = {}) {
  requirePermission(actor, "installments.view");
  const { q, status, page } = parseOrThrow(planListSchema, input);
  await connectDB();
  const today = todayPk();

  const filter = {};
  if (status === "active" || status === "late") filter.status = "active";
  if (status === "completed") filter.status = "completed";
  if (q) {
    const digits = q.replace(/\D/g, "");
    if (/^\d+$/.test(q.trim())) {
      filter.$or = [{ accountNumber: Number(digits) }, { previousAccountNumber: Number(digits) }];
    } else {
      const re = { $regex: q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" };
      const customers = await Customer.find({ $or: [{ name: re }, { fatherOrHusbandName: re }] }).select("_id").limit(500).lean();
      filter.$or = [{ customerId: { $in: customers.map((c) => c._id) } }, { "item.description": re }, { "item.model": re }];
    }
  }

  // "Late" depends on today's date, so it is worked out in memory over active plans.
  let plans;
  let total;
  if (status === "late") {
    const all = await InstallmentPlan.find(filter).sort({ accountNumber: -1 }).lean();
    const late = all.filter((p) => progressFromTotals(p, today).overdue);
    total = late.length;
    plans = late.slice((page - 1) * PLAN_PAGE_SIZE, page * PLAN_PAGE_SIZE);
  } else {
    total = await InstallmentPlan.countDocuments(filter);
    plans = await InstallmentPlan.find(filter)
      .sort({ accountNumber: -1 })
      .skip((page - 1) * PLAN_PAGE_SIZE)
      .limit(PLAN_PAGE_SIZE)
      .lean();
  }

  const customers = await Customer.find({ _id: { $in: plans.map((p) => p.customerId) } }).select("name").lean();
  const byId = new Map(customers.map((c) => [String(c._id), c]));
  return {
    items: plans.map((p) => summary(p, byId.get(String(p.customerId)), today)),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / PLAN_PAGE_SIZE)),
    q,
    status,
  };
}

export async function listPlansForCustomer(actor, customerId) {
  requirePermission(actor, "installments.view");
  assertObjectId(customerId, "Customer");
  await connectDB();
  const plans = await InstallmentPlan.find({ customerId }).sort({ createdAt: -1 }).lean();
  const today = todayPk();
  return plans.map((p) => summary(p, null, today));
}

/** Plans whose account number matches, for the universal search. */
export async function searchPlans(actor, q, { limit = 10 } = {}) {
  requirePermission(actor, "installments.view");
  const digits = String(q ?? "").trim();
  if (!/^\d{1,7}$/.test(digits)) return [];
  await connectDB();
  const n = Number(digits);
  const plans = await InstallmentPlan.find({ $or: [{ accountNumber: n }, { previousAccountNumber: n }] }).limit(limit).lean();
  const customers = await Customer.find({ _id: { $in: plans.map((p) => p.customerId) } }).select("name").lean();
  const byId = new Map(customers.map((c) => [String(c._id), c]));
  const today = todayPk();
  return plans.map((p) => summary(p, byId.get(String(p.customerId)), today));
}

export async function getPlan(actor, id) {
  requirePermission(actor, "installments.view");
  await connectDB();
  const plan = await loadPlan(id);
  const [customer, payments, bike, costEntry] = await Promise.all([
    Customer.findById(plan.customerId).lean(),
    Payment.find({ planId: plan._id }).sort({ paidAt: 1, createdAt: 1 }).lean(),
    plan.relatedBikeId ? Bike.findById(plan.relatedBikeId).select("bikeNumber make model modelYear color purchase.price").lean() : null,
    FinancialTransaction.findOne({ planId: plan._id, type: "item_purchase", status: "posted" }).select("amount occurredAt").lean(),
  ]);
  const staffIds = [...new Set(payments.flatMap((p) => [p.enteredBy, p.voidedBy]).filter(Boolean).map(String))];
  const staff = staffIds.length ? await StaffUser.find({ _id: { $in: staffIds } }).select("name").lean() : [];
  const names = new Map(staff.map((s) => [String(s._id), s.name]));

  const today = todayPk();
  const progress = computeProgress(planForSchedule(plan), payments, today);

  // Running balance after each posted payment, in date order.
  let running = plan.terms.agreedTotal;
  const ledger = payments.map((p) => {
    if (p.status === "posted") running -= p.amount;
    return {
      id: String(p._id),
      kind: p.kind,
      amount: p.amount,
      paidAt: p.paidAt,
      receiptNumber: p.receiptNumber ?? null,
      note: p.note ?? "",
      status: p.status,
      balanceAfter: p.status === "posted" ? running : null,
      enteredBy: names.get(String(p.enteredBy)) ?? "Unknown",
      voidedBy: p.voidedBy ? (names.get(String(p.voidedBy)) ?? "Unknown") : null,
      voidedAt: p.voidedAt ?? null,
      voidReason: p.voidReason ?? null,
      createdAt: p.createdAt,
    };
  });

  return {
    ...summary(plan.toObject(), customer, today),
    customer: customer
      ? { id: String(customer._id), name: customer.name, fatherOrHusbandName: customer.fatherOrHusbandName ?? "", phones: customer.phones ?? [], cnicMasked: maskCnic(customer.cnicNormalized) }
      : null,
    item: { kind: plan.item.kind, description: plan.item.description, model: plan.item.model ?? "", serialNumber: plan.item.serialNumber ?? "" },
    terms: {
      agreementDate: plan.terms.agreementDate,
      cashPrice: plan.terms.cashPrice ?? null,
      agreedTotal: plan.terms.agreedTotal,
      advanceAmount: plan.terms.advanceAmount ?? 0,
      markup: plan.terms.cashPrice != null ? plan.terms.agreedTotal - plan.terms.cashPrice : null,
      schedule: scheduleOut(plan.terms.schedule),
    },
    schedule: scheduleOut(plan.schedule),
    guarantors: (plan.guarantors ?? []).map((g) => ({
      name: g.name,
      fatherName: g.fatherName ?? "",
      cnicMasked: g.cnicNormalized ? maskCnic(g.cnicNormalized) : "",
      profession: g.profession ?? "",
      address: g.address ?? "",
      phones: g.phones ?? [],
    })),
    notes: plan.notes ?? "",
    bike: bike
      ? { id: String(bike._id), bikeNumber: bike.bikeNumber, label: [bike.make, bike.model, bike.modelYear, bike.color].filter(Boolean).join(" ") }
      : null,
    profit: planProfit(plan, bike, costEntry),
    progress,
    ledger,
    completedAt: plan.completedAt ?? null,
    createdAt: plan.createdAt,
  };
}

// ---------- payments ----------

export async function recordPayment(actor, planId, input) {
  requirePermission(actor, "payments.create");
  const data = parseOrThrow(paymentSchema, input);
  await connectDB();

  try {
    return await withTransaction(async (session) => {
      const plan = await loadPlan(planId, session);
      if (plan.status !== "active") throw new ValidationError("This plan is not active.", { amount: "The plan is already closed." });
      if (data.paidAt < plan.terms.agreementDate) {
        throw new ValidationError(undefined, { paidAt: "Cannot be before the agreement date." });
      }
      if (data.amount > plan.totals.balance) {
        throw new ValidationError(undefined, {
          amount: `More than the remaining balance (Rs ${plan.totals.balance.toLocaleString("en-PK")}).`,
        });
      }
      if (data.receiptNumber) await claimReceiptNumber(data.receiptNumber, session);
      const [payment] = await Payment.create(
        [
          {
            planId: plan._id,
            customerId: plan.customerId,
            kind: "installment",
            amount: data.amount,
            paidAt: data.paidAt,
            receiptNumber: data.receiptNumber,
            note: data.note,
            enteredBy: actor.id,
          },
        ],
        { session },
      );
      await recomputePlan(plan, session);
      await recordAudit(
        {
          actor,
          action: "payment.record",
          entityType: "installmentPlan",
          entityId: plan._id,
          after: { amount: data.amount, paidAt: data.paidAt, receiptNumber: data.receiptNumber ?? null, balance: plan.totals.balance },
        },
        session,
      );
      return { id: String(payment._id), balance: plan.totals.balance, completed: plan.status === "completed" };
    });
  } catch (err) {
    rethrowDuplicate(err, { receiptNumber: data.receiptNumber });
  }
}

/** Superadmin only (D-008): close the remaining balance with a non-cash discount. */
export async function applyDiscount(actor, planId, input) {
  requirePermission(actor, "installments.discount");
  const data = parseOrThrow(discountSchema, input);
  await connectDB();
  return withTransaction(async (session) => {
    const plan = await loadPlan(planId, session);
    if (plan.status !== "active" || plan.totals.balance <= 0) {
      throw new ValidationError("There is no balance to close.", {});
    }
    const amount = plan.totals.balance;
    await Payment.create(
      [{ planId: plan._id, customerId: plan.customerId, kind: "discount", amount, paidAt: data.paidAt, note: data.reason, enteredBy: actor.id }],
      { session },
    );
    await recomputePlan(plan, session);
    await recordAudit(
      { actor, action: "plan.discount", entityType: "installmentPlan", entityId: plan._id, after: { amount, paidAt: data.paidAt }, reason: data.reason },
      session,
    );
    return { amount };
  });
}

/** Void a posted payment (kept in history). Discounts can only be voided by the Superadmin. */
export async function voidPayment(actor, paymentId, input) {
  requirePermission(actor, "payments.edit");
  const { reason } = parseOrThrow(voidSchema, input);
  assertObjectId(paymentId, "Payment");
  await connectDB();
  return withTransaction(async (session) => {
    const payment = await Payment.findById(paymentId).session(session);
    if (!payment) throw new NotFoundError("Payment not found.");
    if (payment.status !== "posted") throw new ValidationError("This payment is already voided.", {});
    if (payment.kind === "discount" && !can(actor, "installments.discount")) {
      throw new ForbiddenError("Only the Superadmin can remove a discount.");
    }
    const plan = await loadPlan(payment.planId, session);
    if (plan.status === "cancelled") throw new ValidationError("This plan is cancelled.", {});

    payment.status = "voided";
    payment.voidedAt = new Date();
    payment.voidedBy = actor.id;
    payment.voidReason = reason;
    await payment.save({ session });
    await recomputePlan(plan, session);
    await recordAudit(
      {
        actor,
        action: "payment.void",
        entityType: "installmentPlan",
        entityId: plan._id,
        before: { kind: payment.kind, amount: payment.amount, paidAt: payment.paidAt, receiptNumber: payment.receiptNumber ?? null, status: "posted" },
        after: { status: "voided", balance: plan.totals.balance },
        reason,
      },
      session,
    );
    return { balance: plan.totals.balance };
  });
}

// ---------- edits ----------

/** Change the current schedule (e.g. a new due day). The original agreement terms stay as they were. */
export async function updateSchedule(actor, planId, input) {
  requirePermission(actor, "installments.edit");
  const schedule = parseOrThrow(scheduleSchema, input);
  await connectDB();
  return withTransaction(async (session) => {
    const plan = await loadPlan(planId, session);
    if (plan.terms.advanceAmount < plan.terms.agreedTotal && !schedule.installmentAmount) {
      throw new ValidationError(undefined, { installmentAmount: "Enter the installment amount." });
    }
    if (schedule.firstDueDate && schedule.firstDueDate < plan.terms.agreementDate) {
      throw new ValidationError(undefined, { firstDueDate: "Cannot be before the agreement date." });
    }
    const before = scheduleOut(plan.schedule);
    plan.schedule = schedule;
    await plan.save({ session });
    const after = scheduleOut(plan.schedule);
    if (JSON.stringify(before) === JSON.stringify(after)) return { changed: false };
    await recordAudit(
      { actor, action: "plan.schedule_update", entityType: "installmentPlan", entityId: plan._id, before: { schedule: before }, after: { schedule: after } },
      session,
    );
    return { changed: true };
  });
}

export async function updatePlanDetails(actor, planId, input) {
  requirePermission(actor, "installments.edit");
  const data = parseOrThrow(updatePlanDetailsSchema, input);
  await connectDB();
  return withTransaction(async (session) => {
    const plan = await loadPlan(planId, session);
    const before = auditPlan(plan);
    plan.previousAccountNumber = data.previousAccountNumber;
    plan.item = { kind: data.itemKind, description: data.itemDescription, model: data.itemModel, serialNumber: data.itemSerial };
    // CNICs are shown masked, so an empty CNIC box means "keep the saved one" (matched by name).
    const savedCnic = new Map((plan.guarantors ?? []).filter((g) => g.cnicNormalized).map((g) => [g.name.toLowerCase(), g.cnicNormalized]));
    plan.guarantors = guarantorDocs(data.guarantors.filter((g) => g.name)).map((g) => ({
      ...g,
      cnicNormalized: g.cnicNormalized ?? savedCnic.get(g.name.toLowerCase()),
    }));
    plan.notes = data.notes;
    // A bike from the register takes its cost from the bike, so the field is ignored there.
    if (!plan.relatedBikeId) plan.itemCost = data.itemCost;
    await plan.save({ session });
    // "Paid from business cash" ticked later: record the cash out once (none posted yet).
    let paymentRecorded = false;
    if (!plan.relatedBikeId && data.itemCostPaidFromCash && plan.itemCost) {
      const existing = await FinancialTransaction.exists({ planId: plan._id, type: "item_purchase", status: "posted" }).session(session);
      if (!existing) {
        await recordItemPurchase(actor, plan, session);
        paymentRecorded = true;
      }
    }
    const after = auditPlan(plan);
    if (JSON.stringify(before) === JSON.stringify(after)) return { changed: paymentRecorded };
    await recordAudit({ actor, action: "plan.update", entityType: "installmentPlan", entityId: plan._id, before, after }, session);
    return { changed: true };
  });
}

// ---------- dashboard ----------

export async function getInstallmentOverview(actor) {
  requirePermission(actor, "installments.view");
  await connectDB();
  const today = todayPk();
  const monthStart = parseDateOnly(`${today.slice(0, 7)}-01`);
  const [active, completed, collected] = await Promise.all([
    InstallmentPlan.find({ status: "active" }).lean(),
    InstallmentPlan.countDocuments({ status: "completed" }),
    Payment.aggregate([
      { $match: { status: "posted", kind: { $in: ["advance", "installment"] }, paidAt: { $gte: monthStart } } },
      { $group: { _id: null, sum: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]),
  ]);
  const withProgress = active.map((p) => ({ plan: p, progress: progressFromTotals(p, today) }));
  const late = withProgress.filter((x) => x.progress.overdue).sort((a, b) => b.progress.overdue.daysLate - a.progress.overdue.daysLate);
  const customers = await Customer.find({ _id: { $in: late.slice(0, 5).map((x) => x.plan.customerId) } }).select("name").lean();
  const byId = new Map(customers.map((c) => [String(c._id), c]));
  return {
    activeCount: active.length,
    completedCount: completed,
    outstanding: active.reduce((s, p) => s + (p.totals?.balance ?? 0), 0),
    lateCount: late.length,
    lateAmount: late.reduce((s, x) => s + x.progress.overdue.amount, 0),
    collectedThisMonth: collected[0]?.sum ?? 0,
    paymentsThisMonth: collected[0]?.count ?? 0,
    mostLate: late.slice(0, 5).map((x) => summary(x.plan, byId.get(String(x.plan.customerId)), today)),
  };
}

// ---------- customer portal ----------

/** The signed-in customer's own plans. Never takes a customer id from the request. */
export async function getMyPlans(customerActor) {
  if (!customerActor || customerActor.kind !== "customer") throw new ForbiddenError();
  await connectDB();
  const plans = await InstallmentPlan.find({ customerId: customerActor.id, status: { $ne: "cancelled" } }).sort({ createdAt: -1 }).lean();
  const payments = await Payment.find({ planId: { $in: plans.map((p) => p._id) }, status: "posted" }).sort({ paidAt: 1, createdAt: 1 }).lean();
  const today = todayPk();
  return plans.map((p) => {
    const own = payments.filter((x) => String(x.planId) === String(p._id));
    const progress = computeProgress(planForSchedule(p), own, today);
    let running = p.terms.agreedTotal;
    return {
      id: String(p._id),
      accountNumber: p.accountNumber,
      item: p.item.description,
      agreementDate: p.terms.agreementDate,
      agreedTotal: p.terms.agreedTotal,
      installmentAmount: p.schedule?.installmentAmount ?? null,
      status: p.status,
      progress: { paid: progress.paid, discount: progress.discount, balance: progress.balance, percent: progress.percent, overdue: progress.overdue, nextDue: progress.nextDue },
      payments: own.map((x) => {
        running -= x.amount;
        return { id: String(x._id), kind: x.kind, amount: x.amount, paidAt: x.paidAt, receiptNumber: x.receiptNumber ?? null, balanceAfter: running };
      }),
    };
  });
}
