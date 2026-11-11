import "server-only";
import { Counter } from "@/server/models/Counter";
import { Payment } from "@/server/models/Payment";
import { Bike } from "@/server/models/Bike";
import { ConflictError } from "@/server/errors";

// Sequential numbers that continue the paper records (D-006 answer 1): account numbers,
// receipt numbers and bike stock numbers. A counter keeps the highest number used, so a
// number typed by hand from the paper book moves the series forward.

export const ACCOUNT = "accountNumber";
export const RECEIPT = "receiptNumber";
export const BIKE = "bikeNumber";

export async function peekNumber(name) {
  const c = await Counter.findById(name).lean();
  return (c?.seq ?? 0) + 1;
}

export async function allocateNumber(name, session) {
  const c = await Counter.findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after", session });
  return c.seq;
}

export async function bumpNumber(name, n, session) {
  await Counter.updateOne({ _id: name }, { $max: { seq: n } }, { upsert: true, session });
}

/**
 * Receipt numbers are shared by installment payments and cash bike sales. The payments
 * collection enforces uniqueness with an index; bike sales are checked here as well.
 */
export async function claimReceiptNumber(n, session, fieldName = "receiptNumber") {
  const [inPayments, inSales] = await Promise.all([
    Payment.exists({ receiptNumber: n, status: "posted" }).session(session),
    Bike.exists({ "sale.receiptNumber": n }).session(session),
  ]);
  if (inPayments || inSales) {
    throw new ConflictError(`Receipt number ${n} is already used.`, { [fieldName]: "Already used by another receipt." });
  }
  await bumpNumber(RECEIPT, n, session);
}
