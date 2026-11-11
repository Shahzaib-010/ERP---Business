import "server-only";
import mongoose from "mongoose";
import { connectDB, withTransaction } from "@/server/db/mongoose";
import { Bike } from "@/server/models/Bike";
import { Customer } from "@/server/models/Customer";
import { InstallmentPlan } from "@/server/models/InstallmentPlan";
import { SellerPayment } from "@/server/models/SellerPayment";
import { StaffUser } from "@/server/models/StaffUser";
import { AppError, ConflictError, NotFoundError, ValidationError, parseOrThrow } from "@/server/errors";
import { requirePermission } from "@/server/permissions";
import { recordAudit } from "@/server/services/audit";
import { BIKE, allocateNumber, claimReceiptNumber, peekNumber } from "@/server/services/numbering";
import {
  bikeDetailsSchema,
  bikeListSchema,
  bikePurchaseSchema,
  cashSaleSchema,
  identifierKey,
  reasonSchema,
  sellerPaymentSchema,
} from "@/server/validation/bikes";
import { parseDateOnly, todayPk } from "@/lib/business-date";
import { maskCnic } from "@/lib/cnic";

// Bike register (roadmap Phase 3, D-009). A bike is bought from a seller (paid in full or
// in part; the rest is owed to the seller) and sold to a customer for cash or on an
// installment plan. Seller payments are rows that are voided, never deleted.

export const BIKE_PAGE_SIZE = 25;

function assertObjectId(id, what = "Bike") {
  if (!mongoose.isValidObjectId(id)) throw new NotFoundError(`${what} not found.`);
}

export function bikeLabel(b) {
  return [b.make, b.model, b.modelYear, b.color].filter(Boolean).join(" ");
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keysFor(data) {
  return {
    registration: identifierKey(data.registrationNumber),
    engine: identifierKey(data.engineNumber),
    chassis: identifierKey(data.chassisNumber),
  };
}

function rethrowDuplicate(err) {
  if (err?.code !== 11000) throw err;
  const key = Object.keys(err.keyPattern ?? {})[0] ?? "";
  if (key.includes("registration")) throw new ConflictError("Another bike has this registration number.", { registrationNumber: "Already in the register." });
  if (key.includes("engine")) throw new ConflictError("Another bike has this engine number.", { engineNumber: "Already in the register." });
  if (key.includes("chassis")) throw new ConflictError("Another bike has this chassis number.", { chassisNumber: "Already in the register." });
  throw err;
}

async function recomputePurchase(bike, session) {
  const [row] = await SellerPayment.aggregate([
    { $match: { bikeId: bike._id, status: "posted" } },
    { $group: { _id: null, sum: { $sum: "$amount" } } },
  ]).session(session);
  const paid = row?.sum ?? 0;
  const payable = bike.purchase.price - paid;
  if (payable < 0) throw new AppError("Payments to the seller would exceed the purchase price.", { code: "OVERPAID" });
  bike.purchaseTotals = { paid, payable };
  await bike.save({ session });
}

function auditBike(b) {
  return {
    bikeNumber: b.bikeNumber,
    bike: bikeLabel(b),
    condition: b.condition,
    registrationNumber: b.registrationNumber ?? null,
    engineNumber: b.engineNumber ?? null,
    chassisNumber: b.chassisNumber ?? null,
    seller: b.purchase?.seller?.name ?? null,
    notes: b.notes ?? null,
  };
}

function listItem(b, customersById) {
  const customer = b.sale?.customerId ? customersById?.get(String(b.sale.customerId)) : null;
  return {
    id: String(b._id),
    bikeNumber: b.bikeNumber,
    label: bikeLabel(b),
    make: b.make,
    model: b.model,
    modelYear: b.modelYear ?? null,
    color: b.color ?? "",
    condition: b.condition,
    registrationNumber: b.registrationNumber ?? "",
    engineNumber: b.engineNumber ?? "",
    status: b.status,
    purchaseDate: b.purchase.date,
    purchasePrice: b.purchase.price,
    payable: b.purchaseTotals?.payable ?? 0,
    sellerName: b.purchase.seller.name,
    sale: b.sale?.mode
      ? { mode: b.sale.mode, date: b.sale.date, price: b.sale.price, customer: customer ? { id: String(customer._id), name: customer.name } : null, planId: b.sale.planId ? String(b.sale.planId) : null }
      : null,
  };
}

async function customersFor(bikes) {
  const ids = [...new Set(bikes.filter((b) => b.sale?.customerId).map((b) => String(b.sale.customerId)))];
  const customers = ids.length ? await Customer.find({ _id: { $in: ids } }).select("name").lean() : [];
  return new Map(customers.map((c) => [String(c._id), c]));
}

// ---------- purchase ----------

export async function getNextBikeNumber(actor) {
  requirePermission(actor, "bikes.create");
  await connectDB();
  return peekNumber(BIKE);
}

export async function createBikePurchase(actor, input) {
  requirePermission(actor, "bikes.create");
  const data = parseOrThrow(bikePurchaseSchema, input);
  await connectDB();
  try {
    return await withTransaction(async (session) => {
      const bikeNumber = await allocateNumber(BIKE, session);
      const [bike] = await Bike.create(
        [
          {
            bikeNumber,
            make: data.make,
            model: data.model,
            modelYear: data.modelYear,
            color: data.color,
            condition: data.condition,
            registrationNumber: data.registrationNumber,
            engineNumber: data.engineNumber,
            chassisNumber: data.chassisNumber,
            keys: keysFor(data),
            notes: data.notes,
            purchase: {
              date: data.purchaseDate,
              price: data.purchasePrice,
              seller: { name: data.sellerName, phone: data.sellerPhone, cnicNormalized: data.sellerCnic, address: data.sellerAddress },
            },
            purchaseTotals: { paid: 0, payable: data.purchasePrice },
            createdBy: actor.id,
          },
        ],
        { session },
      );
      if (data.paidNow > 0) {
        await SellerPayment.create(
          [{ bikeId: bike._id, kind: "at_purchase", amount: data.paidNow, paidAt: data.purchaseDate, enteredBy: actor.id }],
          { session },
        );
      }
      await recomputePurchase(bike, session);
      await recordAudit(
        {
          actor,
          action: "bike.purchase",
          entityType: "bike",
          entityId: bike._id,
          after: { ...auditBike(bike), purchasePrice: data.purchasePrice, paidNow: data.paidNow, payable: bike.purchaseTotals.payable },
        },
        session,
      );
      return { id: String(bike._id), bikeNumber };
    });
  } catch (err) {
    rethrowDuplicate(err);
  }
}

export async function recordSellerPayment(actor, bikeId, input) {
  requirePermission(actor, "bikes.create");
  const data = parseOrThrow(sellerPaymentSchema, input);
  assertObjectId(bikeId);
  await connectDB();
  return withTransaction(async (session) => {
    const bike = await Bike.findById(bikeId).session(session);
    if (!bike) throw new NotFoundError("Bike not found.");
    if (data.paidAt < bike.purchase.date) throw new ValidationError(undefined, { paidAt: "Cannot be before the purchase date." });
    if (data.amount > bike.purchaseTotals.payable) {
      throw new ValidationError(undefined, { amount: `More than the amount owed (Rs ${bike.purchaseTotals.payable.toLocaleString("en-PK")}).` });
    }
    await SellerPayment.create([{ bikeId: bike._id, kind: "later", amount: data.amount, paidAt: data.paidAt, note: data.note, enteredBy: actor.id }], { session });
    await recomputePurchase(bike, session);
    await recordAudit(
      { actor, action: "bike.seller_payment", entityType: "bike", entityId: bike._id, after: { amount: data.amount, paidAt: data.paidAt, payable: bike.purchaseTotals.payable } },
      session,
    );
    return { payable: bike.purchaseTotals.payable };
  });
}

export async function voidSellerPayment(actor, paymentId, input) {
  requirePermission(actor, "payments.edit");
  const { reason } = parseOrThrow(reasonSchema, input);
  assertObjectId(paymentId, "Payment");
  await connectDB();
  return withTransaction(async (session) => {
    const payment = await SellerPayment.findById(paymentId).session(session);
    if (!payment) throw new NotFoundError("Payment not found.");
    if (payment.status !== "posted") throw new ValidationError("This payment is already voided.", {});
    const bike = await Bike.findById(payment.bikeId).session(session);
    payment.status = "voided";
    payment.voidedAt = new Date();
    payment.voidedBy = actor.id;
    payment.voidReason = reason;
    await payment.save({ session });
    await recomputePurchase(bike, session);
    await recordAudit(
      {
        actor,
        action: "bike.seller_payment_void",
        entityType: "bike",
        entityId: bike._id,
        before: { amount: payment.amount, paidAt: payment.paidAt, status: "posted" },
        after: { status: "voided", payable: bike.purchaseTotals.payable },
        reason,
      },
      session,
    );
    return { payable: bike.purchaseTotals.payable };
  });
}

// ---------- sale ----------

export async function sellBikeForCash(actor, bikeId, input) {
  requirePermission(actor, "bikes.create");
  const data = parseOrThrow(cashSaleSchema, input);
  assertObjectId(bikeId);
  assertObjectId(data.customerId, "Customer");
  await connectDB();
  return withTransaction(async (session) => {
    const bike = await Bike.findById(bikeId).session(session);
    if (!bike) throw new NotFoundError("Bike not found.");
    if (bike.status !== "in_stock") throw new ValidationError("This bike has already been sold.", {});
    if (data.saleDate < bike.purchase.date) throw new ValidationError(undefined, { saleDate: "Cannot be before the purchase date." });
    const customer = await Customer.findById(data.customerId).session(session);
    if (!customer) throw new ValidationError(undefined, { customerId: "Customer not found." });
    if (data.receiptNumber) await claimReceiptNumber(data.receiptNumber, session);

    bike.status = "sold";
    bike.sale = {
      mode: "cash",
      date: data.saleDate,
      customerId: customer._id,
      price: data.salePrice,
      receiptNumber: data.receiptNumber,
      note: data.note,
      soldBy: actor.id,
    };
    await bike.save({ session });
    await recordAudit(
      {
        actor,
        action: "bike.sell_cash",
        entityType: "bike",
        entityId: bike._id,
        after: { customer: customer.name, price: data.salePrice, date: data.saleDate, receiptNumber: data.receiptNumber ?? null },
      },
      session,
    );
    return { id: String(bike._id) };
  });
}

/**
 * Undo a cash sale entered by mistake: the bike goes back into stock. The sale stays in the
 * audit history. Installment sales are corrected on the plan instead.
 */
export async function cancelCashSale(actor, bikeId, input) {
  requirePermission(actor, "bikes.edit");
  requirePermission(actor, "payments.edit");
  const { reason } = parseOrThrow(reasonSchema, input);
  assertObjectId(bikeId);
  await connectDB();
  return withTransaction(async (session) => {
    const bike = await Bike.findById(bikeId).session(session);
    if (!bike) throw new NotFoundError("Bike not found.");
    if (bike.status !== "sold" || bike.sale?.mode !== "cash") throw new ValidationError("Only a cash sale can be cancelled here.", {});
    const before = { mode: bike.sale.mode, price: bike.sale.price, date: bike.sale.date, receiptNumber: bike.sale.receiptNumber ?? null, customerId: String(bike.sale.customerId) };
    bike.status = "in_stock";
    bike.sale = undefined;
    await bike.save({ session });
    await recordAudit({ actor, action: "bike.sale_cancel", entityType: "bike", entityId: bike._id, before, after: { status: "in_stock" }, reason }, session);
    return { ok: true };
  });
}

// ---------- edit ----------

export async function updateBikeDetails(actor, bikeId, input) {
  requirePermission(actor, "bikes.edit");
  const data = parseOrThrow(bikeDetailsSchema, input);
  assertObjectId(bikeId);
  await connectDB();
  try {
    return await withTransaction(async (session) => {
      const bike = await Bike.findById(bikeId).session(session);
      if (!bike) throw new NotFoundError("Bike not found.");
      const before = auditBike(bike);
      Object.assign(bike, {
        make: data.make,
        model: data.model,
        modelYear: data.modelYear,
        color: data.color,
        condition: data.condition,
        registrationNumber: data.registrationNumber,
        engineNumber: data.engineNumber,
        chassisNumber: data.chassisNumber,
        keys: keysFor(data),
        notes: data.notes,
      });
      bike.purchase.seller = { name: data.sellerName, phone: data.sellerPhone, cnicNormalized: data.sellerCnic ?? bike.purchase.seller.cnicNormalized, address: data.sellerAddress };
      await bike.save({ session });
      const after = auditBike(bike);
      if (JSON.stringify(before) === JSON.stringify(after)) return { changed: false };
      await recordAudit({ actor, action: "bike.update", entityType: "bike", entityId: bike._id, before, after }, session);
      return { changed: true };
    });
  } catch (err) {
    rethrowDuplicate(err);
  }
}

// ---------- read ----------

export async function listBikes(actor, input = {}) {
  requirePermission(actor, "bikes.view");
  const { q, status, page } = parseOrThrow(bikeListSchema, input);
  await connectDB();
  const filter = {};
  if (status === "in_stock" || status === "sold") filter.status = status;
  if (status === "owed") filter["purchaseTotals.payable"] = { $gt: 0 };
  if (q) {
    const n = /^[bB]?-?\d+$/.test(q.trim()) ? Number(q.replace(/\D/g, "")) : null;
    const key = identifierKey(q);
    const re = { $regex: escapeRegex(q), $options: "i" };
    const or = [{ make: re }, { model: re }, { color: re }, { "purchase.seller.name": re }];
    if (key && key.length >= 3) or.push({ "keys.registration": { $regex: escapeRegex(key) } }, { "keys.engine": { $regex: escapeRegex(key) } }, { "keys.chassis": { $regex: escapeRegex(key) } });
    if (n) or.push({ bikeNumber: n });
    filter.$or = or;
  }
  const total = await Bike.countDocuments(filter);
  const bikes = await Bike.find(filter).sort({ bikeNumber: -1 }).skip((page - 1) * BIKE_PAGE_SIZE).limit(BIKE_PAGE_SIZE).lean();
  const customers = await customersFor(bikes);
  return { items: bikes.map((b) => listItem(b, customers)), total, page, pageCount: Math.max(1, Math.ceil(total / BIKE_PAGE_SIZE)), q, status };
}

/** For the universal search: stock number, registration, engine or chassis number. */
export async function searchBikes(actor, q, { limit = 8 } = {}) {
  requirePermission(actor, "bikes.view");
  const raw = String(q ?? "").trim();
  const key = identifierKey(raw);
  if (!key || key.length < 3) {
    if (!/^[bB]-?\d+$/.test(raw)) return [];
  }
  await connectDB();
  const or = [];
  if (key && key.length >= 3) or.push({ "keys.registration": { $regex: escapeRegex(key) } }, { "keys.engine": { $regex: escapeRegex(key) } }, { "keys.chassis": { $regex: escapeRegex(key) } });
  if (/^[bB]-?\d+$/.test(raw)) or.push({ bikeNumber: Number(raw.replace(/\D/g, "")) });
  const bikes = await Bike.find({ $or: or }).sort({ bikeNumber: -1 }).limit(limit).lean();
  const customers = await customersFor(bikes);
  return bikes.map((b) => listItem(b, customers));
}

export async function listBikesForCustomer(actor, customerId) {
  requirePermission(actor, "bikes.view");
  assertObjectId(customerId, "Customer");
  await connectDB();
  const bikes = await Bike.find({ "sale.customerId": customerId }).sort({ "sale.date": -1 }).lean();
  return bikes.map((b) => listItem(b));
}

export async function getBike(actor, id) {
  requirePermission(actor, "bikes.view");
  assertObjectId(id);
  await connectDB();
  const bike = await Bike.findById(id).lean();
  if (!bike) throw new NotFoundError("Bike not found.");
  const [payments, customer, plan] = await Promise.all([
    SellerPayment.find({ bikeId: bike._id }).sort({ paidAt: 1, createdAt: 1 }).lean(),
    bike.sale?.customerId ? Customer.findById(bike.sale.customerId).select("name phones cnicNormalized").lean() : null,
    bike.sale?.planId ? InstallmentPlan.findById(bike.sale.planId).select("accountNumber status totals").lean() : null,
  ]);
  const staffIds = [...new Set([...payments.flatMap((p) => [p.enteredBy, p.voidedBy]), bike.sale?.soldBy].filter(Boolean).map(String))];
  const staff = staffIds.length ? await StaffUser.find({ _id: { $in: staffIds } }).select("name").lean() : [];
  const names = new Map(staff.map((s) => [String(s._id), s.name]));

  let owed = bike.purchase.price;
  return {
    ...listItem(bike),
    chassisNumber: bike.chassisNumber ?? "",
    notes: bike.notes ?? "",
    seller: {
      name: bike.purchase.seller.name,
      phone: bike.purchase.seller.phone ?? "",
      cnicMasked: bike.purchase.seller.cnicNormalized ? maskCnic(bike.purchase.seller.cnicNormalized) : "",
      address: bike.purchase.seller.address ?? "",
    },
    purchase: { date: bike.purchase.date, price: bike.purchase.price, paid: bike.purchaseTotals.paid, payable: bike.purchaseTotals.payable },
    sellerPayments: payments.map((p) => {
      if (p.status === "posted") owed -= p.amount;
      return {
        id: String(p._id),
        kind: p.kind,
        amount: p.amount,
        paidAt: p.paidAt,
        note: p.note ?? "",
        status: p.status,
        owedAfter: p.status === "posted" ? owed : null,
        enteredBy: names.get(String(p.enteredBy)) ?? "Unknown",
        voidedBy: p.voidedBy ? (names.get(String(p.voidedBy)) ?? "Unknown") : null,
        voidReason: p.voidReason ?? null,
      };
    }),
    saleDetail: bike.sale?.mode
      ? {
          mode: bike.sale.mode,
          date: bike.sale.date,
          price: bike.sale.price,
          cashPrice: bike.sale.cashPrice ?? null,
          receiptNumber: bike.sale.receiptNumber ?? null,
          note: bike.sale.note ?? "",
          soldBy: names.get(String(bike.sale.soldBy)) ?? null,
          customer: customer ? { id: String(customer._id), name: customer.name, phones: customer.phones ?? [], cnicMasked: maskCnic(customer.cnicNormalized) } : null,
          plan: plan ? { id: String(plan._id), accountNumber: plan.accountNumber, status: plan.status, balance: plan.totals?.balance ?? 0 } : null,
        }
      : null,
    createdAt: bike.createdAt,
  };
}

/** Lightweight bike info for the plan form (selling on installments). */
export async function getBikeForSale(actor, id) {
  requirePermission(actor, "bikes.view");
  assertObjectId(id);
  await connectDB();
  const b = await Bike.findById(id).lean();
  if (!b) throw new NotFoundError("Bike not found.");
  return {
    id: String(b._id),
    bikeNumber: b.bikeNumber,
    label: bikeLabel(b),
    status: b.status,
    condition: b.condition,
    modelYear: b.modelYear ?? null,
    serial: b.registrationNumber || b.engineNumber || b.chassisNumber || "",
    description: `${b.make} ${b.model}${b.color ? `, ${b.color}` : ""}, ${b.condition}`,
  };
}

export async function getBikeOverview(actor) {
  requirePermission(actor, "bikes.view");
  await connectDB();
  const today = todayPk();
  const monthStart = parseDateOnly(`${today.slice(0, 7)}-01`);
  const [stock, owed, soldThisMonth] = await Promise.all([
    Bike.aggregate([{ $match: { status: "in_stock" } }, { $group: { _id: null, count: { $sum: 1 }, value: { $sum: "$purchase.price" } } }]),
    Bike.aggregate([{ $match: { "purchaseTotals.payable": { $gt: 0 } } }, { $group: { _id: null, count: { $sum: 1 }, sum: { $sum: "$purchaseTotals.payable" } } }]),
    Bike.countDocuments({ status: "sold", "sale.date": { $gte: monthStart } }),
  ]);
  return {
    inStock: stock[0]?.count ?? 0,
    stockValue: stock[0]?.value ?? 0,
    owedToSellers: owed[0]?.sum ?? 0,
    owedBikes: owed[0]?.count ?? 0,
    soldThisMonth,
  };
}
