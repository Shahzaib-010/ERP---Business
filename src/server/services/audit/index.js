import "server-only";
import { AuditLog } from "@/server/models/AuditLog";
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
