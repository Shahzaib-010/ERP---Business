import "server-only";
import mongoose from "mongoose";

// Cash book entries that are not recorded anywhere else: expenses, other income, owner
// investment and owner withdrawals (D-014). Customer payments, seller payments and cash
// bike sales are read from their own collections, so no real-world payment is stored twice.
// Rows are voided with a reason, never edited or deleted.
// "item_purchase" (D-019) is cash paid for an item sold on an installment plan (planId set).
// It is cash out, but not an operating expense: profit takes the cost from the plan instead.
const financialTransactionSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["expense", "other_income", "owner_investment", "owner_withdrawal", "item_purchase"], required: true },
    planId: { type: mongoose.Schema.Types.ObjectId, ref: "InstallmentPlan" },
    category: { type: String, trim: true, maxlength: 40 },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: "Money must be whole rupees." },
    },
    occurredAt: { type: Date, required: true }, // business date
    description: { type: String, trim: true, maxlength: 300, required: true },
    party: { type: String, trim: true, maxlength: 100 }, // paid to / received from
    voucherNumber: { type: String, trim: true, maxlength: 30 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "StaffUser" },
    status: { type: String, enum: ["posted", "voided"], default: "posted" },
    voidedAt: { type: Date },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "StaffUser" },
    voidReason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, collection: "financialTransactions" },
);

financialTransactionSchema.index({ occurredAt: -1 });
financialTransactionSchema.index({ type: 1, occurredAt: -1 });
financialTransactionSchema.index({ planId: 1 }, { sparse: true });

export const FinancialTransaction =
  mongoose.models.FinancialTransaction ?? mongoose.model("FinancialTransaction", financialTransactionSchema);
