import "server-only";
import mongoose from "mongoose";
import { AuditLog } from "@/server/models/AuditLog";
import { StaffUser } from "@/server/models/StaffUser";
import { connectDB } from "@/server/db/mongoose";
import { can, requirePermission } from "@/server/permissions";
import { maskCnic } from "@/lib/cnic";

// Never written to the audit log, whatever the caller passes.
const SECRET_KEYS = new Set(["password", "passwordHash", "token", "tokenHash", "newPassword", "currentPassword"]);

/** A copy of `value` with secrets removed and CNICs masked. */
export function redact(value) {
  if (value == null || typeof value !== "object") return value;
  if (value instanceof Date) return value;
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value.toHexString === "function") return value; // ObjectId
  const src = typeof value.toObject === "function" ? value.toObject() : value;
  const out = {};
  for (const [k, v] of Object.entries(src)) {
    if (SECRET_KEYS.has(k)) continue;
    if (k === "cnicNormalized" && typeof v === "string") out.cnicMasked = maskCnic(v);
    else out[k] = redact(v);
  }
  return out;
}

/**
 * Append one audit row. Pass the Mongo `session` when called inside a transaction so the
 * audit row commits or rolls back together with the change it describes.
 */
export async function recordAudit(
  { actor, action, scope = "operational", entityType, entityId, before, after, reason },
  session,
) {
  const row = {
    actorKind: actor?.kind ?? "system",
    actorId: actor?.id,
    actorRole: actor?.role,
    action,
    scope,
    entityType,
    entityId,
    before: before === undefined ? undefined : redact(before),
    after: after === undefined ? undefined : redact(after),
    reason,
  };
  await AuditLog.create([row], session ? { session } : undefined);
}

/**
 * Change history for one record, newest first, with field-level differences.
 * Operational events need "audit.view"; security events (logins, passwords, portal access)
 * are included only for "audit.viewAll" (Superadmin).
 */
export async function listEntityHistory(actor, { entityType, entityId, limit = 50 }) {
  requirePermission(actor, "audit.view");
  if (!mongoose.isValidObjectId(entityId)) return [];
  await connectDB();
  const scopes = can(actor, "audit.viewAll") ? ["operational", "security"] : ["operational"];
  const rows = await AuditLog.find({ entityType, entityId, scope: { $in: scopes } })
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();
  return withActorNames(rows);
}

/** Latest operational events across the business, for the dashboard. */
export async function listRecentActivity(actor, { limit = 8 } = {}) {
  requirePermission(actor, "audit.view");
  await connectDB();
  const rows = await AuditLog.find({ scope: "operational" }).sort({ createdAt: -1, _id: -1 }).limit(limit).lean();
  return withActorNames(rows);
}

async function withActorNames(rows) {
  const ids = [...new Set(rows.filter((r) => r.actorKind === "staff" && r.actorId).map((r) => String(r.actorId)))];
  const staff = ids.length ? await StaffUser.find({ _id: { $in: ids } }).select("name").lean() : [];
  const names = new Map(staff.map((s) => [String(s._id), s.name]));
  return rows.map((r) => ({
    id: String(r._id),
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId ? String(r.entityId) : null,
    actorName: r.actorKind === "system" ? "System" : (names.get(String(r.actorId)) ?? "Unknown"),
    createdAt: r.createdAt,
    changes: diffSnapshots(r.before, r.after),
    entityName: r.after?.name ?? r.before?.name ?? null,
    reason: r.reason ?? null,
  }));
}

/** [{ field, from, to }] for fields that differ. Values are already redacted. */
export function diffSnapshots(before, after) {
  if (!before || !after) return [];
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const out = [];
  for (const field of keys) {
    const a = before[field] ?? null;
    const b = after[field] ?? null;
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ field, from: a, to: b });
  }
  return out;
}
