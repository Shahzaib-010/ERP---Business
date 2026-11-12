import "server-only";
import mongoose from "mongoose";
import { connectDB } from "@/server/db/mongoose";
import { Bike } from "@/server/models/Bike";
import { Customer } from "@/server/models/Customer";
import { FinancialTransaction } from "@/server/models/FinancialTransaction";
import { InstallmentPlan } from "@/server/models/InstallmentPlan";
import { Payment } from "@/server/models/Payment";
import { SellerPayment } from "@/server/models/SellerPayment";
import { StaffUser } from "@/server/models/StaffUser";
import { NotFoundError } from "@/server/errors";
import { requirePermission } from "@/server/permissions";
import { computeProgress } from "@/lib/installment-schedule";
import { ENTRY_TYPES, categoryLabel } from "@/lib/cashbook";
import { todayPk } from "@/lib/business-date";
import { maskCnic } from "@/lib/cnic";

// Printable receipts and vouchers (roadmap Phase 6). Read-only: printing never changes data.
// Staff need "receipts.view". Customers never get these pages (the portal shows numbers only).
// A CNIC on a receipt is always masked.

function assertId(id, what) {
  if (!mongoose.isValidObjectId(id)) throw new NotFoundError(`${what} not found.`);
}

async function staffName(id) {
  if (!id) return null;
  const s = await StaffUser.findById(id).select("name").lean();
  return s?.name ?? null;
}

function customerOut(c) {
  if (!c) return null;
  return {
    name: c.name,
    fatherOrHusbandName: c.fatherOrHusbandName ?? "",
    cnicMasked: maskCnic(c.cnicNormalized),
    phone: c.phones?.[0] ?? null,
    address: c.collectionAddress || c.homeAddress || "",
  };
}

/** Receipt for an installment payment or advance. Discounts are not receipts. */
export async function getPaymentReceipt(actor, paymentId) {
  requirePermission(actor, "receipts.view");
  assertId(paymentId, "Receipt");
  await connectDB();
  const payment = await Payment.findById(paymentId).lean();
  if (!payment || payment.kind === "discount") throw new NotFoundError("Receipt not found.");
  const [plan, customer, all] = await Promise.all([
    InstallmentPlan.findById(payment.planId).lean(),
    Customer.findById(payment.customerId).lean(),
    Payment.find({ planId: payment.planId }).sort({ paidAt: 1, createdAt: 1 }).lean(),
  ]);

  // Balance just before and after this payment, in ledger order (posted rows only).
  let balance = plan.terms.agreedTotal;
  let before = balance;
  let paidToDate = 0;
  for (const p of all) {
    if (String(p._id) === String(payment._id)) {
      before = balance;
      if (p.status === "posted") {
        balance -= p.amount;
        if (p.kind !== "discount") paidToDate += p.amount;
      }
      break;
    }
    if (p.status === "posted") {
      balance -= p.amount;
      if (p.kind !== "discount") paidToDate += p.amount;
    }
  }
  const progress = computeProgress(
    { agreedTotal: plan.terms.agreedTotal, advanceAmount: plan.terms.advanceAmount ?? 0, agreementDate: plan.terms.agreementDate, schedule: plan.schedule, status: plan.status },
    all,
    todayPk(),
  );

  return {
    kind: "payment",
    title: payment.kind === "advance" ? "Advance receipt" : "Installment receipt",
    receiptNumber: payment.receiptNumber ?? null,
    date: payment.paidAt,
    amount: payment.amount,
    status: payment.status,
    voidReason: payment.voidReason ?? null,
    note: payment.note ?? "",
    receivedBy: await staffName(payment.enteredBy),
    customer: customerOut(customer),
    plan: {
      id: String(plan._id),
      accountNumber: plan.accountNumber,
      item: plan.item.description,
      serial: plan.item.serialNumber ?? "",
      agreedTotal: plan.terms.agreedTotal,
      paidToDate,
      balanceBefore: before,
      balanceAfter: payment.status === "posted" ? before - payment.amount : before,
      currentBalance: plan.totals.balance,
      nextDue: progress.nextDue,
      installmentAmount: plan.schedule?.installmentAmount ?? null,
    },
  };
}

/** Receipt for a bike sold for cash. */
export async function getBikeSaleReceipt(actor, bikeId) {
  requirePermission(actor, "receipts.view");
  assertId(bikeId, "Receipt");
  await connectDB();
  const bike = await Bike.findById(bikeId).lean();
  if (!bike || bike.status !== "sold" || bike.sale?.mode !== "cash") throw new NotFoundError("Receipt not found.");
  const customer = await Customer.findById(bike.sale.customerId).lean();
  return {
    kind: "bike_sale",
    title: "Sale receipt",
    receiptNumber: bike.sale.receiptNumber ?? null,
    date: bike.sale.date,
    amount: bike.sale.price,
    status: "posted",
    note: bike.sale.note ?? "",
    receivedBy: await staffName(bike.sale.soldBy),
    customer: customerOut(customer),
    bike: {
      id: String(bike._id),
      bikeNumber: bike.bikeNumber,
      make: bike.make,
      model: bike.model,
      modelYear: bike.modelYear ?? null,
      color: bike.color ?? "",
      condition: bike.condition,
      registrationNumber: bike.registrationNumber ?? "",
      engineNumber: bike.engineNumber ?? "",
      chassisNumber: bike.chassisNumber ?? "",
    },
  };
}

/** Voucher for money paid to a bike seller. */
export async function getSellerVoucher(actor, sellerPaymentId) {
  requirePermission(actor, "receipts.view");
  assertId(sellerPaymentId, "Voucher");
  await connectDB();
  const p = await SellerPayment.findById(sellerPaymentId).lean();
  if (!p) throw new NotFoundError("Voucher not found.");
  const [bike, all] = await Promise.all([Bike.findById(p.bikeId).lean(), SellerPayment.find({ bikeId: p.bikeId }).sort({ paidAt: 1, createdAt: 1 }).lean()]);
  let owed = bike.purchase.price;
  let owedAfter = owed;
  for (const x of all) {
    if (x.status === "posted") owed -= x.amount;
    if (String(x._id) === String(p._id)) {
      owedAfter = owed;
      break;
    }
  }
  return {
    kind: "seller_payment",
    title: "Payment voucher",
    voucherNumber: `SP-${String(p._id).slice(-6).toUpperCase()}`,
    date: p.paidAt,
    amount: p.amount,
    status: p.status,
    voidReason: p.voidReason ?? null,
    note: p.note ?? "",
    paidBy: await staffName(p.enteredBy),
    payee: { name: bike.purchase.seller.name, phone: bike.purchase.seller.phone ?? null, cnicMasked: bike.purchase.seller.cnicNormalized ? maskCnic(bike.purchase.seller.cnicNormalized) : "" },
    purpose: `Payment for bike B-${bike.bikeNumber}: ${[bike.make, bike.model, bike.modelYear, bike.color].filter(Boolean).join(" ")}`,
    bike: { id: String(bike._id), bikeNumber: bike.bikeNumber, purchasePrice: bike.purchase.price, owedAfter },
  };
}

/** Voucher for a cash book entry (expense, other income, owner money). */
export async function getCashbookVoucher(actor, transactionId) {
  requirePermission(actor, "receipts.view");
  assertId(transactionId, "Voucher");
  await connectDB();
  const t = await FinancialTransaction.findById(transactionId).lean();
  if (!t) throw new NotFoundError("Voucher not found.");
  const direction = ENTRY_TYPES[t.type].direction;
  return {
    kind: "cashbook",
    title: direction === "in" ? "Cash receipt" : "Payment voucher",
    voucherNumber: t.voucherNumber || `CB-${String(t._id).slice(-6).toUpperCase()}`,
    date: t.occurredAt,
    amount: t.amount,
    status: t.status,
    voidReason: t.voidReason ?? null,
    direction,
    typeLabel: ENTRY_TYPES[t.type].label,
    categoryLabel: categoryLabel(t.type, t.category),
    description: t.description,
    party: t.party ?? "",
    enteredBy: await staffName(t.createdBy),
  };
}
