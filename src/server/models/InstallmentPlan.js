import "server-only";
import mongoose from "mongoose";

// An installment agreement for any item (doc 03, D-004, D-006, D-009).
// `terms` is the original agreement and is never changed after creation.
// `schedule` is the current payment schedule; staff may adjust it (audited).
// `totals` caches the sum of posted payments; it is recomputed after every payment change.

const money = { type: Number, min: 0, validate: { validator: Number.isInteger, message: "Money must be whole rupees." } };

const guarantorSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 100, required: true },
    fatherName: { type: String, trim: true, maxlength: 100 },
    cnicNormalized: { type: String, match: /^\d{13}$/ },
    profession: { type: String, trim: true, maxlength: 100 },
    address: { type: String, trim: true, maxlength: 300 },
    phones: { type: [String], default: [] },
  },
  { _id: false },
);

const scheduleSchema = new mongoose.Schema(
  {
    frequency: { type: String, enum: ["monthly", "weekly", "daily", "custom"], required: true },
    intervalDays: { type: Number, min: 1, max: 365 },
    dueDayOfMonth: { type: Number, min: 1, max: 31 },
    installmentAmount: money,
    firstDueDate: { type: Date },
  },
  { _id: false },
);

const planSchema = new mongoose.Schema(
  {
    accountNumber: { type: Number, required: true, min: 1 },
    previousAccountNumber: { type: Number, min: 1 },
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },

    item: {
      kind: { type: String, enum: ["bike", "mobile", "appliance", "other"], required: true },
      description: { type: String, trim: true, maxlength: 200, required: true },
      model: { type: String, trim: true, maxlength: 100 },
      serialNumber: { type: String, trim: true, maxlength: 100 }, // registration / engine / IMEI
    },
    relatedBikeId: { type: mongoose.Schema.Types.ObjectId, ref: "Bike" }, // Phase 3

    terms: {
      agreementDate: { type: Date, required: true },
      cashPrice: money,
      agreedTotal: { ...money, required: true },
      advanceAmount: { ...money, default: 0 },
      schedule: { type: scheduleSchema, required: true },
    },
    schedule: { type: scheduleSchema, required: true },

    guarantors: { type: [guarantorSchema], default: [] },
    notes: { type: String, trim: true, maxlength: 2000 },

    totals: {
      cashReceived: { ...money, default: 0 },
      discount: { ...money, default: 0 },
      balance: { ...money, default: 0 },
      lastPaymentAt: { type: Date },
    },
    status: { type: String, enum: ["active", "completed", "cancelled"], default: "active" },
    completedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "StaffUser" },
  },
  { timestamps: true, collection: "installmentPlans" },
);

planSchema.index({ accountNumber: 1 }, { unique: true });
planSchema.index({ customerId: 1, createdAt: -1 });
planSchema.index({ status: 1, createdAt: -1 });

export const InstallmentPlan =
  mongoose.models.InstallmentPlan ?? mongoose.model("InstallmentPlan", planSchema);
