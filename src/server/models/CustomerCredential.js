import "server-only";
import mongoose from "mongoose";

// Kept apart from the customer profile so profile queries can never leak a password hash.
const customerCredentialSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true },
    passwordHash: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    passwordChangedAt: { type: Date },
    lastLoginAt: { type: Date },
  },
  { timestamps: true, collection: "customerCredentials" },
);

customerCredentialSchema.index({ customerId: 1 }, { unique: true });

export const CustomerCredential =
  mongoose.models.CustomerCredential ??
  mongoose.model("CustomerCredential", customerCredentialSchema);
