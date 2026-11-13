// Phase 2 acceptance tests: customers and universal search.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { startTestDb } from "./helpers.mjs";

let db;
let mods;

// Services only look at these fields, so plain objects stand in for signed-in actors.
const staff = (role, permissions = []) => ({
  kind: "staff",
  id: new mongoose.Types.ObjectId().toHexString(),
  role,
  permissions,
  isActive: true,
});
const owner = staff("superadmin");
const admin = staff("admin");
const viewer = staff("user", ["customers.view"]);
const nobody = staff("user", []);
const customerActor = { kind: "customer", id: new mongoose.Types.ObjectId().toHexString() };

before(async () => {
  db = await startTestDb();
  mods = {
    customers: await import("@/server/services/customers"),
    search: await import("@/server/services/search"),
    errors: await import("@/server/errors"),
    Customer: (await import("@/server/models/Customer")).Customer,
    AuditLog: (await import("@/server/models/AuditLog")).AuditLog,
  };
});
after(async () => db?.stop());

const base = {
  name: "Ali Raza",
  fatherOrHusbandName: "Muhammad Raza",
  cnic: "31303-1234567-1",
  phones: ["0300-1234567", "", "0300 1234567"],
  homeAddress: "Model Town",
};

describe("customer records", () => {
  let aliId;

  test("WhatsApp number is stored as digits, searchable, cleared when emptied, and validated", async () => {
    const { id } = await mods.customers.createCustomer(owner, {
      name: "Wasim Akram",
      cnic: "42101-5550001-1",
      phones: ["0300-1112223"],
      whatsapp: "0345 9998887",
    });
    let detail = await mods.customers.getCustomer(owner, id);
    assert.equal(detail.whatsapp, "03459998887");
    const { items } = await mods.customers.listCustomers(owner, { q: "0345-999" });
    assert.ok(items.some((c) => c.id === id), "found by WhatsApp number");

    await mods.customers.updateCustomer(owner, id, { ...detail, whatsapp: "" });
    detail = await mods.customers.getCustomer(owner, id);
    assert.equal(detail.whatsapp, "");

    const err = await mods.customers
      .createCustomer(owner, { name: "Bad Number", cnic: "42101-5550002-1", whatsapp: "12" })
      .catch((e) => e);
    assert.ok(err.fieldErrors?.whatsapp, "too-short WhatsApp number rejected");
  });

  test("create normalizes CNIC and phones and writes an audit row without the full CNIC", async () => {
    const { id } = await mods.customers.createCustomer(owner, base);
    aliId = id;
    const doc = await mods.Customer.findById(id).lean();
    assert.equal(doc.cnicNormalized, "3130312345671");
    assert.deepEqual(doc.phones, ["03001234567"], "blank and duplicate phones are dropped");
    assert.equal(doc.caste, undefined, "empty optional fields are not stored");
    assert.equal(doc.whatsapp, undefined, "no WhatsApp number unless given");

    const audit = await mods.AuditLog.findOne({ action: "customer.create", entityId: doc._id }).lean();
    assert.ok(audit, "audit row written");
    assert.equal(audit.scope, "operational");
    assert.equal(audit.after.cnicMasked, "*****-***4567-1");
    assert.ok(!JSON.stringify(audit).includes("3130312345671"), "full CNIC never in the audit log");
  });

  test("the same CNIC cannot be registered twice, in any format", async () => {
    const err = await mods.customers
      .createCustomer(owner, { ...base, name: "Someone Else", cnic: "3130312345671" })
      .catch((e) => e);
    assert.ok(err instanceof mods.errors.ConflictError);
    assert.ok(err.fieldErrors.cnic);
  });

  test("invalid input gives field errors", async () => {
    const err = await mods.customers
      .createCustomer(owner, { name: "A", cnic: "12345", phones: ["12"] })
      .catch((e) => e);
    assert.ok(err instanceof mods.errors.ValidationError);
    assert.ok(err.fieldErrors.name);
    assert.ok(err.fieldErrors.cnic);
    assert.ok(Object.keys(err.fieldErrors).some((k) => k.startsWith("phones")));
  });

  test("detail shows the full CNIC; list items only the masked one", async () => {
    const detail = await mods.customers.getCustomer(viewer, aliId);
    assert.equal(detail.cnic, "31303-1234567-1");
    assert.equal(detail.portal.enabled, false);

    const { items } = await mods.customers.listCustomers(viewer, {});
    const row = items.find((c) => c.id === aliId);
    assert.equal(row.cnicMasked, "*****-***4567-1");
    assert.equal(row.cnic, undefined);
    assert.ok(!JSON.stringify(items).includes("3130312345671"));
  });

  test("update clears emptied fields and records before/after", async () => {
    await mods.customers.updateCustomer(admin, aliId, {
      ...base,
      homeAddress: "",
      profession: "Driver",
      phones: ["0301-7654321"],
    });
    const doc = await mods.Customer.findById(aliId).lean();
    assert.equal(doc.homeAddress, undefined);
    assert.equal(doc.profession, "Driver");
    assert.deepEqual(doc.phones, ["03017654321"]);

    const audit = await mods.AuditLog.findOne({ action: "customer.update", entityId: doc._id }).lean();
    assert.equal(audit.before.homeAddress, "Model Town");
    assert.equal(audit.after.homeAddress, null);
    assert.equal(audit.after.profession, "Driver");
  });

  test("saving without changes writes no audit row", async () => {
    const current = await mods.customers.getCustomer(owner, aliId);
    const before = await mods.AuditLog.countDocuments({ entityId: new mongoose.Types.ObjectId(aliId) });
    const result = await mods.customers.updateCustomer(owner, aliId, { ...current, phones: current.phones });
    assert.equal(result.changed, false);
    const afterCount = await mods.AuditLog.countDocuments({ entityId: new mongoose.Types.ObjectId(aliId) });
    assert.equal(afterCount, before);
  });

  test("changing the CNIC to another customer's CNIC is refused", async () => {
    await mods.customers.createCustomer(owner, { name: "Bilal Ahmed", cnic: "31303-7654321-3", phones: ["0333-1112223"] });
    await assert.rejects(
      mods.customers.updateCustomer(owner, aliId, { ...base, cnic: "31303-7654321-3" }),
      mods.errors.ConflictError,
    );
  });

  test("unknown or malformed ids are 'not found'", async () => {
    await assert.rejects(mods.customers.getCustomer(owner, "not-an-id"), mods.errors.NotFoundError);
    await assert.rejects(
      mods.customers.getCustomer(owner, new mongoose.Types.ObjectId().toHexString()),
      mods.errors.NotFoundError,
    );
  });
});

describe("customer search", () => {
  const names = (list) => list.map((c) => c.name).sort();

  test("by part of the name, any case", async () => {
    assert.deepEqual(names(await mods.customers.searchCustomers(viewer, "raz")), ["Ali Raza"]);
    assert.deepEqual(names(await mods.customers.searchCustomers(viewer, "BILAL")), ["Bilal Ahmed"]);
  });

  test("newest customers come first, at most the limit, and need customers.view", async () => {
    const created = [];
    for (const [i, name] of ["Newest One", "Newest Two", "Newest Three", "Newest Four", "Newest Five"].entries()) {
      created.push(await mods.customers.createCustomer(owner, { name, cnic: `61101-777000${i}-1` }));
    }
    const list = await mods.customers.recentCustomers(viewer, { limit: 4 });
    assert.deepEqual(
      list.map((c) => c.name),
      ["Newest Five", "Newest Four", "Newest Three", "Newest Two"],
    );
    assert.ok(list.every((c) => c.cnicMasked && !("cnic" in c)), "only the masked CNIC is returned");
    await assert.rejects(mods.customers.recentCustomers({ kind: "staff", id: "x", role: "user", permissions: [], isActive: true }));
  });

  test("by father's name", async () => {
    assert.deepEqual(names(await mods.customers.searchCustomers(viewer, "muhammad raza")), ["Ali Raza"]);
  });

  test("by full or partial CNIC, with or without dashes", async () => {
    assert.deepEqual(names(await mods.customers.searchCustomers(viewer, "31303-1234567-1")), ["Ali Raza"]);
    assert.deepEqual(names(await mods.customers.searchCustomers(viewer, "7654321-3")), ["Bilal Ahmed"]);
    assert.deepEqual(names(await mods.customers.searchCustomers(viewer, "31303")), ["Ali Raza", "Bilal Ahmed"]);
  });

  test("by phone, including +92 format", async () => {
    assert.deepEqual(names(await mods.customers.searchCustomers(viewer, "0333-1112223")), ["Bilal Ahmed"]);
    assert.deepEqual(names(await mods.customers.searchCustomers(viewer, "+92 333 1112223")), ["Bilal Ahmed"]);
  });

  test("regex characters are treated as plain text", async () => {
    assert.deepEqual(await mods.customers.searchCustomers(viewer, ".*"), []);
    assert.deepEqual(await mods.customers.searchCustomers(viewer, "a(b"), []);
  });

  test("too-short input finds nothing rather than everything", async () => {
    assert.deepEqual(await mods.customers.searchCustomers(viewer, "a"), []);
    assert.deepEqual(await mods.customers.searchCustomers(viewer, "12"), []);
  });

  test("list paginates", async () => {
    for (let i = 0; i < 30; i++) {
      await mods.customers.createCustomer(owner, {
        name: `Page Test ${String(i).padStart(2, "0")}`,
        cnic: `99999${String(i).padStart(7, "0")}1`,
      });
    }
    const p1 = await mods.customers.listCustomers(viewer, { q: "page test" });
    assert.equal(p1.total, 30);
    assert.equal(p1.items.length, mods.customers.CUSTOMER_PAGE_SIZE);
    assert.equal(p1.pageCount, 2);
    const p2 = await mods.customers.listCustomers(viewer, { q: "page test", page: "2" });
    assert.equal(p2.items.length, 30 - mods.customers.CUSTOMER_PAGE_SIZE);
    const beyond = await mods.customers.listCustomers(viewer, { q: "page test", page: "99" });
    assert.equal(beyond.page, 2, "a page past the end shows the last page");
  });
});

describe("permissions", () => {
  test("a User without customers.view cannot read customers", async () => {
    await assert.rejects(mods.customers.listCustomers(nobody, {}), mods.errors.ForbiddenError);
    await assert.rejects(mods.customers.searchCustomers(nobody, "ali"), mods.errors.ForbiddenError);
    const [any] = (await mods.customers.listCustomers(owner, {})).items;
    await assert.rejects(mods.customers.getCustomer(nobody, any.id), mods.errors.ForbiddenError);
  });

  test("view permission alone cannot create or edit", async () => {
    await assert.rejects(
      mods.customers.createCustomer(viewer, { name: "New One", cnic: "31303-0000000-9" }),
      mods.errors.ForbiddenError,
    );
    const [any] = (await mods.customers.listCustomers(owner, {})).items;
    await assert.rejects(
      mods.customers.updateCustomer(viewer, any.id, { name: "X Y", cnic: "31303-0000000-9" }),
      mods.errors.ForbiddenError,
    );
  });

  test("customer portal users and signed-out callers cannot use customer services or search", async () => {
    await assert.rejects(mods.customers.listCustomers(customerActor, {}), mods.errors.ForbiddenError);
    await assert.rejects(mods.search.universalSearch(customerActor, "ali"), mods.errors.ForbiddenError);
    await assert.rejects(mods.search.universalSearch(null, "ali"), mods.errors.AuthenticationError);
  });

  test("universal search only returns groups the actor may see", async () => {
    const forViewer = await mods.search.universalSearch(viewer, "ali");
    assert.deepEqual(forViewer.groups.map((g) => g.type), ["customers"]);
    assert.ok(forViewer.groups[0].items.some((c) => c.name === "Ali Raza"));

    const forNobody = await mods.search.universalSearch(nobody, "ali");
    assert.deepEqual(forNobody.groups, []);
    assert.deepEqual(forNobody.searchable, []);
  });
});
