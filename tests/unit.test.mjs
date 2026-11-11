import { test } from "node:test";
import assert from "node:assert/strict";
import { formatCnic, maskCnic, normalizeCnic } from "@/lib/cnic";
import { can, sanitizeGrantedPermissions } from "@/server/permissions";
import { redact } from "@/server/services/audit";

const staff = (role, permissions = []) => ({ kind: "staff", id: "x", role, permissions, isActive: true });

test("CNIC normalisation accepts dashes and spaces, rejects wrong lengths", () => {
  assert.equal(normalizeCnic("31303-1234567-1"), "3130312345671");
  assert.equal(normalizeCnic(" 31303 1234567 1 "), "3130312345671");
  assert.equal(normalizeCnic("31303-1234567"), null);
  assert.equal(normalizeCnic("31303-1234567-12"), null);
  assert.equal(normalizeCnic(undefined), null);
  assert.equal(formatCnic("3130312345671"), "31303-1234567-1");
  assert.equal(maskCnic("3130312345671"), "*****-***4567-1");
});

test("Superadmin can do everything", () => {
  assert.ok(can(staff("superadmin"), "users.manage"));
  assert.ok(can(staff("superadmin"), "payments.edit"));
});

test("Admin has daily work but not staff management or settings", () => {
  const admin = staff("admin");
  assert.ok(can(admin, "customers.create"));
  assert.ok(can(admin, "payments.edit"));
  assert.ok(can(admin, "audit.view"));
  assert.equal(can(admin, "users.manage"), false);
  assert.equal(can(admin, "settings.manage"), false);
  assert.equal(can(admin, "audit.viewAll"), false);
});

test("User has only granted permissions, and can never hold Superadmin-only ones", () => {
  assert.equal(can(staff("user"), "customers.view"), false);
  const u = staff("user", ["customers.view", "users.manage"]);
  assert.ok(can(u, "customers.view"));
  assert.equal(can(u, "customers.create"), false);
  assert.equal(can(u, "users.manage"), false, "users.manage is ignored even if stored");
});

test("Customers, disabled staff and unknown roles are denied", () => {
  assert.equal(can({ kind: "customer", id: "c" }, "customers.view"), false);
  assert.equal(can({ ...staff("superadmin"), isActive: false }, "customers.view"), false);
  assert.equal(can(staff("owner"), "customers.view"), false);
  assert.equal(can(null, "customers.view"), false);
});

test("sanitizeGrantedPermissions drops non-grantable keys and duplicates", () => {
  assert.deepEqual(
    sanitizeGrantedPermissions(["payments.create", "users.manage", "payments.create", "bogus"]),
    ["payments.create"],
  );
});

test("redact removes secrets and masks CNIC at any depth", () => {
  const out = redact({
    name: "A",
    passwordHash: "h",
    nested: { password: "p", cnicNormalized: "3130312345671", token: "t" },
  });
  assert.deepEqual(out, { name: "A", nested: { cnicMasked: "*****-***4567-1" } });
});
