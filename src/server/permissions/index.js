import "server-only";
import { ADMIN_PERMISSIONS, GRANTABLE_PERMISSIONS } from "@/lib/permissions-catalog";
import { AuthenticationError, ForbiddenError } from "@/server/errors";

const adminSet = new Set(ADMIN_PERMISSIONS);
const grantableSet = new Set(GRANTABLE_PERMISSIONS);

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
      return adminSet.has(permission);
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

/** Drop anything that is not grantable (e.g. "users.manage" smuggled into a form post). */
export function sanitizeGrantedPermissions(list) {
  return [...new Set((list ?? []).filter((p) => grantableSet.has(p)))].sort();
}
