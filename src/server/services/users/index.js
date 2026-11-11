import "server-only";
import mongoose from "mongoose";
import { connectDB, withTransaction } from "@/server/db/mongoose";
import { StaffUser } from "@/server/models/StaffUser";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  parseOrThrow,
} from "@/server/errors";
import { requirePermission, requireStaffActor, sanitizeGrantedPermissions } from "@/server/permissions";
import {
  changeOwnPasswordSchema,
  createStaffSchema,
  resetPasswordSchema,
  superadminSetupSchema,
  updateStaffSchema,
} from "@/server/validation/auth";
import { recordAudit } from "@/server/services/audit";
import { deleteSessionsFor } from "@/server/services/auth/sessions";

// Staff account management. Only a Superadmin may manage accounts (open decision 3:
// whether Admin may create Users is not decided yet, so it stays Superadmin-only).

const PUBLIC_FIELDS = "name username role permissions isActive lastLoginAt createdAt updatedAt";

function toPublic(user) {
  return {
    id: String(user._id),
    name: user.name,
    username: user.username,
    role: user.role,
    permissions: user.role === "user" ? (user.permissions ?? []) : [],
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt ?? null,
    createdAt: user.createdAt ?? null,
  };
}

function auditSnapshot(user) {
  return {
    name: user.name,
    username: user.username,
    role: user.role,
    permissions: user.permissions ?? [],
    isActive: user.isActive,
  };
}

function assertObjectId(id) {
  if (!mongoose.isValidObjectId(id)) throw new NotFoundError("Staff account not found.");
}

export async function listStaff(actor) {
  requirePermission(actor, "users.manage");
  await connectDB();
  const users = await StaffUser.find().select(PUBLIC_FIELDS).sort({ role: 1, name: 1 }).lean();
  return users.map(toPublic);
}

export async function getStaff(actor, id) {
  requirePermission(actor, "users.manage");
  assertObjectId(id);
  await connectDB();
  const user = await StaffUser.findById(id).select(PUBLIC_FIELDS).lean();
  if (!user) throw new NotFoundError("Staff account not found.");
  return toPublic(user);
}

/** Superadmin creates an Admin or User account. Superadmin accounts cannot be created here. */
export async function createStaff(actor, input) {
  requirePermission(actor, "users.manage");
  const data = parseOrThrow(createStaffSchema, input);
  const permissions = data.role === "user" ? sanitizeGrantedPermissions(data.permissions) : [];
  const passwordHash = await hashPassword(data.password);
  await connectDB();

  try {
    return await withTransaction(async (session) => {
      const [user] = await StaffUser.create(
        [
          {
            name: data.name,
            username: data.username,
            passwordHash,
            role: data.role,
            permissions,
            passwordChangedAt: new Date(),
            createdBy: actor.id,
          },
        ],
        { session },
      );
      await recordAudit(
        {
          actor,
          action: "staff.create",
          scope: "security",
          entityType: "staffUser",
          entityId: user._id,
          after: auditSnapshot(user),
        },
        session,
      );
      return toPublic(user);
    });
  } catch (err) {
    if (err?.code === 11000) {
      throw new ConflictError("That username is already taken.", { username: "Already taken." });
    }
    throw err;
  }
}

/** Change name, role, permissions or active state of an Admin or User account. */
export async function updateStaff(actor, id, input) {
  requirePermission(actor, "users.manage");
  assertObjectId(id);
  const data = parseOrThrow(updateStaffSchema, input);
  if (id === actor.id) {
    throw new ForbiddenError("You cannot change your own role or disable your own account.");
  }
  await connectDB();

  return withTransaction(async (session) => {
    const user = await StaffUser.findById(id).session(session);
    if (!user) throw new NotFoundError("Staff account not found.");
    if (user.role === "superadmin") {
      throw new ForbiddenError("Superadmin accounts cannot be changed here.");
    }

    const before = auditSnapshot(user);
    user.name = data.name;
    user.role = data.role;
    user.permissions = data.role === "user" ? sanitizeGrantedPermissions(data.permissions) : [];
    user.isActive = data.isActive;
    await user.save({ session });

    if (!user.isActive) await deleteSessionsFor("staff", user._id, { session });

    await recordAudit(
      {
        actor,
        action: "staff.update",
        scope: "security",
        entityType: "staffUser",
        entityId: user._id,
        before,
        after: auditSnapshot(user),
      },
      session,
    );
    return toPublic(user);
  });
}

/** Superadmin sets a new password for an Admin or User. Signs that account out everywhere. */
export async function resetStaffPassword(actor, id, input) {
  requirePermission(actor, "users.manage");
  assertObjectId(id);
  const { password } = parseOrThrow(resetPasswordSchema, input);
  if (id === actor.id) throw new ForbiddenError("Use “Change my password” for your own account.");
  const passwordHash = await hashPassword(password);
  await connectDB();

  await withTransaction(async (session) => {
    const user = await StaffUser.findById(id).session(session);
    if (!user) throw new NotFoundError("Staff account not found.");
    if (user.role === "superadmin") {
      throw new ForbiddenError("Superadmin passwords cannot be reset here.");
    }
    user.passwordHash = passwordHash;
    user.passwordChangedAt = new Date();
    await user.save({ session });
    await deleteSessionsFor("staff", user._id, { session });
    await recordAudit(
      {
        actor,
        action: "staff.password_reset",
        scope: "security",
        entityType: "staffUser",
        entityId: user._id,
      },
      session,
    );
  });
}

/** Any staff member changes their own password. Other sessions are signed out. */
export async function changeOwnPassword(actor, input) {
  requireStaffActor(actor);
  const data = parseOrThrow(changeOwnPasswordSchema, input);
  await connectDB();

  const user = await StaffUser.findById(actor.id).select("+passwordHash");
  if (!user) throw new NotFoundError("Staff account not found.");
  if (!(await verifyPassword(data.currentPassword, user.passwordHash))) {
    throw new ValidationError(undefined, { currentPassword: "Current password is not correct." });
  }
  const passwordHash = await hashPassword(data.newPassword);

  await withTransaction(async (session) => {
    user.passwordHash = passwordHash;
    user.passwordChangedAt = new Date();
    await user.save({ session });
    await deleteSessionsFor("staff", user._id, { exceptSessionId: actor.sessionId, session });
    await recordAudit(
      {
        actor,
        action: "staff.password_change",
        scope: "security",
        entityType: "staffUser",
        entityId: user._id,
      },
      session,
    );
  });
}

/**
 * One-time setup: creates the first Superadmin. Refuses if any Superadmin already exists.
 * Called only from `scripts/create-superadmin.mjs`, never from a web route.
 */
export async function createInitialSuperadmin(input) {
  const data = parseOrThrow(superadminSetupSchema, input);
  await connectDB();
  const passwordHash = await hashPassword(data.password);

  return withTransaction(async (session) => {
    const existing = await StaffUser.countDocuments({ role: "superadmin" }).session(session);
    if (existing > 0) throw new ConflictError("A Superadmin already exists.");
    const [user] = await StaffUser.create(
      [
        {
          name: data.name,
          username: data.username,
          passwordHash,
          role: "superadmin",
          passwordChangedAt: new Date(),
        },
      ],
      { session },
    );
    await recordAudit(
      {
        action: "staff.bootstrap_superadmin",
        scope: "security",
        entityType: "staffUser",
        entityId: user._id,
        after: auditSnapshot(user),
      },
      session,
    );
    return toPublic(user);
  });
}
