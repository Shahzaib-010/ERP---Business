import "server-only";
import mongoose from "mongoose";

// Append-only. The app never updates or deletes audit rows.
const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId },
    actorKind: { type: String, enum: ["staff", "customer", "system"], required: true },
    actorRole: { type: String },
    action: { type: String, required: true }, // e.g. "staff.create", "auth.login"
    // "security" events (logins, accounts, permissions) are visible to Superadmin only.
    scope: { type: String, enum: ["security", "operational"], required: true },
    entityType: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    before: { type: mongoose.Schema.Types.Mixed },
    after: { type: mongoose.Schema.Types.Mixed },
    reason: { type: String, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false }, collection: "auditLogs" },
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ scope: 1, createdAt: -1 });

export const AuditLog = mongoose.models.AuditLog ?? mongoose.model("AuditLog", auditLogSchema);
