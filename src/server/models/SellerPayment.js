import "server-only";
import mongoose from "mongoose";

// Money paid to the person or supplier a bike was bought from. One row per payment; the
// bike's "payable" is the purchase price minus posted rows. Rows are voided, never deleted.
const sellerPaymentSchema = new mongoose.Schema(
  {
    bikeId: { type: mongoose.Schema.Types.ObjectId, ref: "Bike", required: true },
    kind: { type: String, enum: ["at_purchase", "later"], required: true },
    amount: {
      type: Number,
      required: true,
      min: 1,
      validate: { validator: Number.isInteger, message: "Money must be whole rupees." },
    },
    paidAt: { type: Date, required: true }, // business date
    note: { type: String, trim: true, maxlength: 500 },
    enteredBy: { type: mongoose.Schema.Types.ObjectId, ref: "StaffUser" },
    status: { type: String, enum: ["posted", "voided"], default: "posted" },
    voidedAt: { type: Date },
    voidedBy: { type: mongoose.Schema.Types.ObjectId, ref: "StaffUser" },
    voidReason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true, collection: "sellerPayments" },
);

sellerPaymentSchema.index({ bikeId: 1, paidAt: 1, createdAt: 1 });
sellerPaymentSchema.index({ paidAt: -1 });

export const SellerPayment = mongoose.models.SellerPayment ?? mongoose.model("SellerPayment", sellerPaymentSchema);
