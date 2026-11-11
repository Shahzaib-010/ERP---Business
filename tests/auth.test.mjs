// Phase 1 acceptance tests against a real (in-memory) MongoDB replica set.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import { startTestDb } from "./helpers.mjs";

let db;
let mods;

before(async () => {
  db = await startTestDb();
  mods = {
    users: await import("@/server/services/users"),
    login: await import("@/server/services/auth/login"),
    sessions: await import("@/server/services/auth/sessions"),
    portal: await import("@/server/services/customers/portal-access"),
    errors: await import("@/server/errors"),
    throttle: await import("@/server/services/auth/throttle"),
    Customer: (await import("@/server/models/Customer")).Customer,
    AuditLog: (await import("@/server/models/AuditLog")).AuditLog,
    StaffUser: (await import("@/server/models/StaffUser")).StaffUser,
  };
});
after(async () => db?.stop());

async function loginAs(username, password, meta = {}) {
  const { token } = await mods.login.loginStaff({ username, password }, meta);
  return mods.sessions.resolveSession(token);
}

describe("staff accounts and login", () => {
  let owner; // Superadmin actor
  let admin;
  let clerk; // "user" role

  test("bootstrap creates exactly one Superadmin", async () => {
    const sa = await mods.users.createInitialSuperadmin({
      name: "Owner",
      username: "Owner",
      password: "owner-pass-1",
    });
    assert.equal(sa.username, "owner", "usernames are stored lower-case");
    assert.equal(sa.role, "superadmin");
    await assert.rejects(
      mods.users.createInitialSuperadmin({ name: "Two", username: "two", password: "another-pass" }),
      mods.errors.ConflictError,
    );
  });

  test("Superadmin logs in; session resolves to the staff actor", async () => {
    owner = await loginAs("OWNER", "owner-pass-1");
    assert.equal(owner.kind, "staff");
    assert.equal(owner.role, "superadmin");
  });

  test("wrong password and unknown username give the same message", async () => {
    const e1 = await mods.login.loginStaff({ username: "owner", password: "wrong-pass" }).catch((e) => e);
    const e2 = await mods.login.loginStaff({ username: "nobody", password: "wrong-pass" }).catch((e) => e);
    assert.equal(e1.code, "LOGIN_FAILED");
    assert.equal(e1.message, e2.message);
  });

  test("Superadmin creates an Admin and a User with sanitised permissions", async () => {
    await mods.users.createStaff(owner, {
      name: "Ali Admin",
      username: "ali",
      role: "admin",
      password: "admin-pass-1",
      permissions: ["customers.view"],
    });
    const created = await mods.users.createStaff(owner, {
      name: "Clerk",
      username: "clerk",
      role: "user",
      password: "clerk-pass-1",
      permissions: ["customers.view", "users.manage", "made.up"],
    });
    assert.deepEqual(created.permissions, ["customers.view"]);

    admin = await loginAs("ali", "admin-pass-1");
    clerk = await loginAs("clerk", "clerk-pass-1");
    assert.equal(admin.role, "admin");
    assert.deepEqual(clerk.permissions, ["customers.view"]);
  });

  test("Superadmin role cannot be created through createStaff", async () => {
    await assert.rejects(
      mods.users.createStaff(owner, { name: "X", username: "x1", role: "superadmin", password: "pass-word-1" }),
      mods.errors.ValidationError,
    );
  });

  test("duplicate username is refused", async () => {
    await assert.rejects(
      mods.users.createStaff(owner, { name: "Ali 2", username: "ALI", role: "user", password: "pass-word-1" }),
      mods.errors.ConflictError,
    );
  });

  test("Admin and User cannot manage staff accounts", async () => {
    const input = { name: "Sneaky", username: "sneaky", role: "admin", password: "pass-word-1" };
    await assert.rejects(mods.users.createStaff(admin, input), mods.errors.ForbiddenError);
    await assert.rejects(mods.users.createStaff(clerk, input), mods.errors.ForbiddenError);
    await assert.rejects(mods.users.listStaff(clerk), mods.errors.ForbiddenError);
    await assert.rejects(mods.users.listStaff(null), mods.errors.AuthenticationError);
  });

  test("Superadmin cannot disable themselves, and Superadmin accounts cannot be edited", async () => {
    await assert.rejects(
      mods.users.updateStaff(owner, owner.id, { name: "Owner", role: "admin", permissions: [], isActive: false }),
      mods.errors.ForbiddenError,
    );
    await assert.rejects(
      mods.users.resetStaffPassword(owner, owner.id, { password: "new-pass-123" }),
      mods.errors.ForbiddenError,
    );
  });

  test("permission changes apply on the next request without logging out", async () => {
    await mods.users.updateStaff(owner, clerk.id, {
      name: "Clerk",
      role: "user",
      permissions: ["customers.view", "payments.create"],
      isActive: true,
    });
    const { token } = await mods.login.loginStaff({ username: "clerk", password: "clerk-pass-1" });
    const fresh = await mods.sessions.resolveSession(token);
    assert.deepEqual(fresh.permissions, ["customers.view", "payments.create"]);
  });

  test("disabling an account ends its sessions at once and blocks login", async () => {
    const { token } = await mods.login.loginStaff({ username: "clerk", password: "clerk-pass-1" });
    assert.ok(await mods.sessions.resolveSession(token));

    await mods.users.updateStaff(owner, clerk.id, {
      name: "Clerk",
      role: "user",
      permissions: [],
      isActive: false,
    });
    assert.equal(await mods.sessions.resolveSession(token), null);
    const err = await mods.login.loginStaff({ username: "clerk", password: "clerk-pass-1" }).catch((e) => e);
    assert.match(err.message, /disabled/);
  });

  test("password reset by Superadmin signs the account out", async () => {
    const { token } = await mods.login.loginStaff({ username: "ali", password: "admin-pass-1" });
    await mods.users.resetStaffPassword(owner, admin.id, { password: "admin-pass-2" });
    assert.equal(await mods.sessions.resolveSession(token), null);
    admin = await loginAs("ali", "admin-pass-2");
    assert.ok(admin);
  });

  test("changing own password needs the current one and keeps only this session", async () => {
    const other = await mods.login.loginStaff({ username: "ali", password: "admin-pass-2" });
    await assert.rejects(
      mods.users.changeOwnPassword(admin, {
        currentPassword: "wrong",
        newPassword: "admin-pass-3",
        confirmPassword: "admin-pass-3",
      }),
      mods.errors.ValidationError,
    );
    await mods.users.changeOwnPassword(admin, {
      currentPassword: "admin-pass-2",
      newPassword: "admin-pass-3",
      confirmPassword: "admin-pass-3",
    });
    assert.equal(await mods.sessions.resolveSession(other.token), null, "other device signed out");
    // `admin` was created by its own login; its session is the one kept.
    const sessionsLeft = await (await import("@/server/models/Session")).Session.countDocuments({
      subjectId: admin.id,
    });
    assert.equal(sessionsLeft, 1);
  });

  test("logout deletes the session", async () => {
    const { token } = await mods.login.loginStaff({ username: "owner", password: "owner-pass-1" });
    await mods.sessions.deleteSessionByToken(token);
    assert.equal(await mods.sessions.resolveSession(token), null);
  });

  test("too many failures lock the account, even with the right password", async () => {
    await mods.users.createStaff(owner, { name: "Target", username: "target", role: "user", password: "target-pass-1" });
    for (let i = 0; i < mods.throttle.LIMITS.account; i++) {
      await mods.login.loginStaff({ username: "target", password: "bad-pass" }).catch(() => {});
    }
    await assert.rejects(
      mods.login.loginStaff({ username: "target", password: "target-pass-1" }),
      mods.errors.RateLimitError,
    );
  });

  test("garbage or missing tokens resolve to null", async () => {
    assert.equal(await mods.sessions.resolveSession(undefined), null);
    assert.equal(await mods.sessions.resolveSession("not-a-real-token"), null);
    assert.equal(await mods.sessions.resolveSession("x".repeat(5000)), null);
  });

  test("audit log has account events and never a password or hash", async () => {
    const rows = await mods.AuditLog.find().lean();
    const actions = new Set(rows.map((r) => r.action));
    for (const a of ["staff.bootstrap_superadmin", "staff.create", "staff.update", "staff.password_reset", "staff.password_change", "auth.staff_login"]) {
      assert.ok(actions.has(a), `missing audit action ${a}`);
    }
    const text = JSON.stringify(rows);
    assert.doesNotMatch(text, /passwordHash|\$2[aby]\$/);
    assert.doesNotMatch(text, /pass-\d/);
  });

  describe("customer portal login", () => {
    let customerId;

    test("a customer without portal access cannot log in", async () => {
      const c = await mods.Customer.create({ name: "Customer One", cnicNormalized: "3130312345671" });
      customerId = String(c._id);
      await assert.rejects(
        mods.login.loginCustomer({ cnic: "31303-1234567-1", password: "anything-1" }),
        (e) => e.code === "LOGIN_FAILED",
      );
    });

    test("a User without customers.edit cannot set a portal password", async () => {
      await mods.users.updateStaff(owner, clerk.id, { name: "Clerk", role: "user", permissions: ["customers.view"], isActive: true });
      const clerkNow = await loginAs("clerk", "clerk-pass-1");
      await assert.rejects(
        mods.portal.setCustomerPortalPassword(clerkNow, customerId, { password: "cust-pass-1" }),
        mods.errors.ForbiddenError,
      );
    });

    test("after staff set a password, CNIC (any format) + password logs in", async () => {
      await mods.portal.setCustomerPortalPassword(admin, customerId, { password: "cust-pass-1" });
      const { token } = await mods.login.loginCustomer({ cnic: "3130312345671", password: "cust-pass-1" });
      const actor = await mods.sessions.resolveSession(token);
      assert.equal(actor.kind, "customer");
      assert.equal(actor.id, customerId);
      assert.equal(actor.role, undefined);

      const again = await mods.login.loginCustomer({ cnic: "31303 1234567 1", password: "cust-pass-1" });
      assert.ok(again.token);
    });

    test("CNIC alone or a wrong password never logs in", async () => {
      for (const password of ["", "wrong-pass"]) {
        await assert.rejects(mods.login.loginCustomer({ cnic: "31303-1234567-1", password }));
      }
      await assert.rejects(
        mods.login.loginCustomer({ cnic: "1234", password: "cust-pass-1" }),
        mods.errors.ValidationError,
      );
    });

    test("a customer session never passes a staff permission check", async () => {
      const { can } = await import("@/server/permissions");
      const { token } = await mods.login.loginCustomer({ cnic: "3130312345671", password: "cust-pass-1" });
      const actor = await mods.sessions.resolveSession(token);
      assert.equal(can(actor, "customers.view"), false);
      await assert.rejects(mods.users.listStaff(actor), mods.errors.ForbiddenError);
    });

    test("disabling the portal ends the customer's sessions", async () => {
      const { token } = await mods.login.loginCustomer({ cnic: "3130312345671", password: "cust-pass-1" });
      await mods.portal.disableCustomerPortal(admin, customerId);
      assert.equal(await mods.sessions.resolveSession(token), null);
      await assert.rejects(mods.login.loginCustomer({ cnic: "3130312345671", password: "cust-pass-1" }));
    });
  });
});
