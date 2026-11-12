import "server-only";
import { ADMIN_PERMISSIONS, GRANTABLE_PERMISSIONS, OPT_IN_PERMISSIONS } from "@/lib/permissions-catalog";
import { AuthenticationError, ForbiddenError } from "@/server/errors";

const adminSet = new Set(ADMIN_PERMISSIONS);
const grantableSet = new Set(GRANTABLE_PERMISSIONS);
const optInSet = new Set(OPT_IN_PERMISSIONS);

/**
 * Deny by default. `actor` is the staff object returned by the session layer:
 * `{ kind: "staff", id, role, permissions }`. Customers never pass a staff check.
 */
export function can(actor, permission) {
  if (!actor || actor.kind !== "staff" || !actor.isActive) return false;
  switch (actor.role) {
    case "superadmin":
      return true;
    case "admin":
      // Admin: the role's set, plus opt-in permissions ticked on this account.
      return adminSet.has(permission) || (optInSet.has(permission) && (actor.permissions ?? []).includes(permission));
    case "user":
      // A User only has what was explicitly granted, and only from the grantable list.
      return grantableSet.has(permission) && (actor.permissions ?? []).includes(permission);
    default:
      return false;
  }
}

export function requirePermission(actor, permission) {
  if (!actor) throw new AuthenticationError();
  if (!can(actor, permission)) throw new ForbiddenError();
}

export function requireStaffActor(actor) {
  if (!actor) throw new AuthenticationError();
  if (actor.kind !== "staff" || !actor.isActive) throw new ForbiddenError();
}

/**
 * Drop anything that is not grantable (e.g. "users.manage" smuggled into a form post).
 * A User keeps any grantable permission; an Admin keeps only opt-in ones (the rest come
 * with the role); a Superadmin stores none.
 */
export function sanitizeGrantedPermissions(list, role = "user") {
  const allowed = role === "user" ? grantableSet : role === "admin" ? optInSet : new Set();
  return [...new Set((list ?? []).filter((p) => allowed.has(p)))].sort();
}
