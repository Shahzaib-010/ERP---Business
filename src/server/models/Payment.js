import "server-only";
import mongoose from "mongoose";

// One row per real-world payment against a plan (doc 03: never overwrite a "last payment").
// kind "discount" is the Superadmin-only settlement discount (D-008): it settles the balance
// but is not cash. Posted rows are never deleted or edited; corrections void them (with a
// reason) and the void is audited.
const paymentSchema = new mongoose.Schema(
  {
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "InstallmentPlan", required: true },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    kind: { type: String, enum: ["advance", "installment", "discount"], required: true },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: "Money must be whole rupees." },
    },
    paidAt: { type: Date, required: true }, // business date (00:00 UTC of the calendar day)
    receiptNumber: { type: Number, min: 1 }, // optional: old paper payments may have none
    note: { type: String, trim: true, maxlength: 500 },
    enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: "StaffUser" },
    status: { type: String, enum: ["posted", "voided"], default: "posted" },
    voidedAt: { type: Date },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "StaffUser" },
    voidReason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, collection: "payments" },
);

paymentSchema.index({ planId: 1, paidAt: 1, createdAt: 1 });
paymentSchema.index({ customerId: 1, paidAt: -1 });
paymentSchema.index({ paidAt: -1 });
// A receipt number belongs to one posted payment. Voided rows keep theirs for history.
paymentSchema.index(
  { receiptNumber: 1 },
  { unique: true, partialFilterExpression: { receiptNumber: { $exists: true }, status: "posted" } },
);

export const Payment = mongoose.models.Payment ?? mongoose.model("Payment", paymentSchema);
