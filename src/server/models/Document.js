import "server-only";
import mongoose from "mongoose";

// Metadata for one private file. The file itself lives in object storage under `storageKey`
// (random, never shown). Lifecycle (D-017):
//   pending  -> upload started, file not confirmed yet (never listed)
//   active   -> confirmed and listed on the record
//   removed  -> in the bin: hidden from the record, can be restored
//   erased   -> file permanently deleted from storage; this row stays as the audit trail
const documentSchema = new mongoose.Schema(
  {
    ownerType: { type: String, enum: ["customer", "plan", "bike"], required: true },
    ownerId: { type: mongoose.Schema.Types.ObjectId, required: true },
    category: { type: String, required: true },
    label: { type: String, trim: true, required: true, maxlength: 120 },
    originalName: { type: String, trim: true, required: true, maxlength: 200 },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true, min: 1 },
    storageKey: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "active", "removed", "erased"], default: "pending" },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: "StaffUser", required: true },
    confirmedAt: { type: Date },
    removedAt: { type: Date },
    removedBy: { type: mongoose.Schema.Types.ObjectId, ref: "StaffUser" },
    removeReason: { type: String, trim: true, maxlength: 500 },
    erasedAt: { type: Date },
    erasedBy: { type: mongoose.Schema.Types.ObjectId, ref: "StaffUser" },
  },
  { timestamps: true, collection: "documents" },
);

documentSchema.index({ ownerType: 1, ownerId: 1, status: 1, createdAt: -1 });

export const Document = mongoose.models.Document ?? mongoose.model("Document", documentSchema);
