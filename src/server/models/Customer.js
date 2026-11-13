import "server-only";
import mongoose from "mongoose";

// Fields come from the paper agreement and ledger card (docs/07 §7.2).
// Screens: src/app/(staff)/customers. Service: src/server/services/customers.
const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    fatherOrHusbandName: { type: String, trim: true, maxlength: 100 },
    caste: { type: String, trim: true, maxlength: 60 },
    profession: { type: String, trim: true, maxlength: 100 },
    designation: { type: String, trim: true, maxlength: 100 },
    // 13 digits, no dashes. Unique: the CNIC is the customer's identity.
    cnicNormalized: { type: String, required: true, match: /^\d{13}$/ },
    phones: { type: [String], default: [] },
    // Digits only, as typed (e.g. "03001234567"). May differ from the phone numbers.
    whatsapp: { type: String, match: /^\d{7,15}$/ },
    homeAddress: { type: String, trim: true, maxlength: 300 },
    collectionAddress: { type: String, trim: true, maxlength: 300 },
    businessAddress: { type: String, trim: true, maxlength: 300 },
    notes: { type: String, trim: true, maxlength: 1000 },
    portalEnabled: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "StaffUser" },
  },
  { timestamps: true, collection: "customers" },
);

customerSchema.index({ cnicNormalized: 1 }, { unique: true });
customerSchema.index({ phones: 1 });
customerSchema.index({ name: 1, _id: 1 });
customerSchema.index({ createdAt: -1, _id: -1 });

export const Customer = mongoose.models.Customer ?? mongoose.model("Customer", customerSchema);
