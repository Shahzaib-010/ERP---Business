import "server-only";
import mongoose from "mongoose";

// One motorcycle in the register (roadmap Phase 3, fields confirmed in D-009).
// The purchase (from a seller) and the sale (to a customer) are kept on the bike as
// snapshots. Payments to the seller are separate rows (SellerPayment) so the amount owed is
// always the sum of real payments.

const money = { type: Number, min: 0, validate: { validator: Number.isInteger, message: "Money must be whole rupees." } };

const bikeSchema = new mongoose.Schema(
  {
    bikeNumber: { type: Number, required: true, min: 1 }, // stock number: B-1, B-2, …
    make: { type: String, trim: true, maxlength: 60, required: true },
    model: { type: String, trim: true, maxlength: 80, required: true },
    modelYear: { type: Number, min: 1950, max: 2100 },
    color: { type: String, trim: true, maxlength: 40 },
    condition: { type: String, enum: ["new", "used"], required: true },
    registrationNumber: { type: String, trim: true, maxlength: 30 },
    engineNumber: { type: String, trim: true, maxlength: 40 },
    chassisNumber: { type: String, trim: true, maxlength: 40 },
    // Upper-case letters and digits only, for duplicate checks and search.
    keys: {
      registration: { type: String },
      engine: { type: String },
      chassis: { type: String },
    },
    notes: { type: String, trim: true, maxlength: 2000 },
    // Photos are optional (D-008); upload arrives with private file storage in Phase 6.
    photoIds: { type: [String], default: [] },

    status: { type: String, enum: ["in_stock", "sold"], default: "in_stock" },

    purchase: {
      date: { type: Date, required: true }, // business date
      price: { ...money, required: true },
      seller: {
        name: { type: String, trim: true, maxlength: 100, required: true },
        phone: { type: String },
        cnicNormalized: { type: String, match: /^\d{13}$/ },
        address: { type: String, trim: true, maxlength: 300 },
      },
    },
    purchaseTotals: {
      paid: { ...money, default: 0 },
      payable: { ...money, default: 0 },
    },

    sale: {
      mode: { type: String, enum: ["cash", "installment"] },
      date: { type: Date },
      customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer" },
      price: money, // cash sale price, or the plan's total price
      cashPrice: money, // installment sales: the cash price on the agreement, if given
      planId: { type: mongoose.Schema.Types.ObjectId, ref: "InstallmentPlan" },
      receiptNumber: { type: Number, min: 1 },
      note: { type: String, trim: true, maxlength: 500 },
      soldBy: { type: mongoose.Schema.Types.ObjectId, ref: "StaffUser" },
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "StaffUser" },
  },
  { timestamps: true, collection: "bikes" },
);

bikeSchema.index({ bikeNumber: 1 }, { unique: true });
bikeSchema.index({ status: 1, createdAt: -1 });
bikeSchema.index({ "keys.registration": 1 }, { unique: true, partialFilterExpression: { "keys.registration": { $type: "string" } } });
bikeSchema.index({ "keys.engine": 1 }, { unique: true, partialFilterExpression: { "keys.engine": { $type: "string" } } });
bikeSchema.index({ "keys.chassis": 1 }, { unique: true, partialFilterExpression: { "keys.chassis": { $type: "string" } } });
bikeSchema.index({ "sale.customerId": 1 });
bikeSchema.index({ "sale.planId": 1 });

export const Bike = mongoose.models.Bike ?? mongoose.model("Bike", bikeSchema);
