// Phase 6 tests: private documents (D-017). Storage is an in-memory fake.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { startTestDb } from "./helpers.mjs";

let db;
let m;
let store;
const staff = (role, permissions = []) => ({ kind: "staff", id: new mongoose.Types.ObjectId().toHexString(), role, permissions, isActive: true });
const owner = staff("superadmin");
const admin = staff("admin");
const viewer = staff("user", ["customers.view", "documents.view"]);
const customerActor = { kind: "customer", id: new mongoose.Types.ObjectId().toHexString(), isActive: true };

const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 0, 0, 0, 0];
const EXE = [0x4d, 0x5a, 0x90, 0x00, 0x03, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];

before(async () => {
  db = await startTestDb();
  const storage = await import("@/server/storage");
  store = storage.createMemoryStorage();
  storage.setStorageForTests(store);
  m = {
    docs: await import("@/server/services/documents"),
    customers: await import("@/server/services/customers"),
    audit: await import("@/server/services/audit"),
    errors: await import("@/server/errors"),
    Document: (await import("@/server/models/Document")).Document,
  };
});
after(async () => db?.stop());

/** Start an upload, "PUT" the bytes like the browser would, then confirm. */
async function upload(actor, ownerId, { bytes = PDF, mimeType = "application/pdf", fileName = "cnic.pdf", label = "CNIC copy", size } = {}) {
  const started = await m.docs.startUpload(actor, {
    ownerType: "customer",
    ownerId,
    category: "identity",
    label,
    fileName,
    mimeType,
    size: size ?? bytes.length,
  });
  const key = started.uploadUrl.replace("memory://put/", "");
  store.put(key, bytes, mimeType);
  return { started, key, confirm: () => m.docs.confirmUpload(actor, started.documentId) };
}

describe("documents", () => {
  let customerId;

  before(async () => {
    customerId = (await m.customers.createCustomer(owner, { name: "Docs Customer", cnic: "31303-7777777-7", phones: ["0300-7777777"] })).id;
  });

  test("upload, list and open; storage key and URLs never appear in the list", async () => {
    const { key, confirm } = await upload(admin, customerId);
    assert.match(key, /^documents\/[0-9a-f]{32}\.pdf$/, "random key, no names or ids");
    const doc = await confirm();
    assert.equal(doc.status, "active");

    const list = await m.docs.listDocuments(viewer, { ownerType: "customer", ownerId: customerId });
    assert.equal(list.documents.length, 1);
    assert.equal(list.canUpload, false);
    assert.equal(list.canRemove, false);
    assert.equal(JSON.stringify(list).includes(key), false);
    assert.equal(list.documents[0].storageKey, undefined);

    const url = await m.docs.getDocumentUrl(viewer, doc.id, { download: true });
    assert.equal(url, `memory://get/${key}?download=1`);
  });

  test("opening a document is audited (security scope), without the URL", async () => {
    const { confirm } = await upload(admin, customerId, { label: "Audit check" });
    const doc = await confirm();
    await m.docs.getDocumentUrl(admin, doc.id);
    const history = await m.audit.listEntityHistory(owner, { entityType: "customer", entityId: customerId });
    const views = history.filter((h) => h.action === "document.view");
    assert.ok(views.length >= 1);
    assert.equal(JSON.stringify(history).includes("memory://"), false);
  });

  test("refuses wrong types, mismatched names, oversize files and fake contents", async () => {
    const { ValidationError } = m.errors;
    const start = (over) =>
      m.docs.startUpload(admin, { ownerType: "customer", ownerId: customerId, category: "identity", label: "x", fileName: "a.pdf", mimeType: "application/pdf", size: 100, ...over });
    await assert.rejects(start({ fileName: "a.exe", mimeType: "application/x-msdownload" }), ValidationError);
    await assert.rejects(start({ fileName: "a.png" }), ValidationError, "extension must match the type");
    await assert.rejects(start({ size: 10 * 1024 * 1024 + 1 }), ValidationError);

    // Claims to be a PDF but is an executable: refused at confirm and deleted from storage.
    const fake = await upload(admin, customerId, { bytes: EXE, label: "Fake" });
    await assert.rejects(fake.confirm(), ValidationError);
    assert.equal(store.objects.has(fake.key), false);
    assert.equal(await m.Document.countDocuments({ _id: fake.started.documentId }), 0);

    // Declared size differs from what was stored.
    const sized = await upload(admin, customerId, { bytes: PNG, mimeType: "image/png", fileName: "p.png", size: 999 });
    await assert.rejects(sized.confirm(), ValidationError);

    // Nothing uploaded at all.
    const started = await m.docs.startUpload(admin, { ownerType: "customer", ownerId: customerId, category: "identity", label: "y", fileName: "y.pdf", mimeType: "application/pdf", size: 18 });
    await assert.rejects(m.docs.confirmUpload(admin, started.documentId), ValidationError);
  });

  test("only the uploader can confirm their own pending upload", async () => {
    const { started } = await upload(admin, customerId, { label: "Someone else's" });
    await assert.rejects(m.docs.confirmUpload(owner, started.documentId), m.errors.NotFoundError);
  });

  test("bin: Admin cannot remove; Superadmin removes, restores and erases (D-017)", async () => {
    const { ForbiddenError, ValidationError } = m.errors;
    const { key, confirm } = await upload(admin, customerId, { label: "Blurry photo" });
    const doc = await confirm();

    await assert.rejects(m.docs.removeDocument(admin, doc.id, { reason: "duplicate" }), ForbiddenError);
    await assert.rejects(m.docs.removeDocument(owner, doc.id, { reason: "" }), ValidationError, "a reason is required");

    await m.docs.removeDocument(owner, doc.id, { reason: "Blurry, re-uploaded" });
    let list = await m.docs.listDocuments(admin, { ownerType: "customer", ownerId: customerId });
    assert.equal(list.documents.some((d) => d.id === doc.id), false, "hidden from the record");
    assert.equal(list.bin.length, 0, "Admins do not see the bin");
    await assert.rejects(m.docs.getDocumentUrl(admin, doc.id), m.errors.NotFoundError, "Admins cannot open binned files");
    assert.ok(store.objects.has(key), "the file is kept while in the bin");

    list = await m.docs.listDocuments(owner, { ownerType: "customer", ownerId: customerId });
    assert.equal(list.bin[0].removeReason, "Blurry, re-uploaded");

    await m.docs.restoreDocument(owner, doc.id);
    list = await m.docs.listDocuments(admin, { ownerType: "customer", ownerId: customerId });
    assert.ok(list.documents.some((d) => d.id === doc.id));

    // Erase only from the bin, then the file is gone but the row remains as the trail.
    await assert.rejects(m.docs.eraseDocument(owner, doc.id, { reason: "wrong customer" }), m.errors.NotFoundError);
    await m.docs.removeDocument(owner, doc.id, { reason: "wrong customer" });
    await m.docs.eraseDocument(owner, doc.id, { reason: "wrong customer" });
    assert.equal(store.objects.has(key), false);
    const row = await m.Document.findById(doc.id).lean();
    assert.equal(row.status, "erased");
    await assert.rejects(m.docs.getDocumentUrl(owner, doc.id), m.errors.NotFoundError);
  });

  test("an Admin given the opt-in permission can use the bin", async () => {
    const trusted = staff("admin", ["documents.remove"]);
    const doc = await (await upload(admin, customerId, { label: "Extra copy" })).confirm();
    await m.docs.removeDocument(trusted, doc.id, { reason: "extra copy" });
    const list = await m.docs.listDocuments(trusted, { ownerType: "customer", ownerId: customerId });
    assert.ok(list.bin.some((d) => d.id === doc.id));
  });

  test("access control: customers, missing permissions, unknown records", async () => {
    const { AuthenticationError, ForbiddenError, NotFoundError } = m.errors;
    const doc = await (await upload(admin, customerId, { label: "Private" })).confirm();
    await assert.rejects(m.docs.listDocuments(customerActor, { ownerType: "customer", ownerId: customerId }), ForbiddenError);
    await assert.rejects(m.docs.getDocumentUrl(customerActor, doc.id), ForbiddenError);
    await assert.rejects(m.docs.getDocumentUrl(null, doc.id), AuthenticationError);
    // Has documents.view but not the record's own view permission.
    const noCustomers = staff("user", ["documents.view"]);
    await assert.rejects(m.docs.getDocumentUrl(noCustomers, doc.id), ForbiddenError);
    // Viewer cannot upload.
    await assert.rejects(upload(viewer, customerId), ForbiddenError);
    // Unknown owner.
    await assert.rejects(upload(admin, new mongoose.Types.ObjectId().toHexString()), NotFoundError);
  });

  test("without storage settings the list still works and uploads explain why", async () => {
    const storage = await import("@/server/storage");
    storage.setStorageForTests(null);
    try {
      const list = await m.docs.listDocuments(admin, { ownerType: "customer", ownerId: customerId });
      assert.equal(list.storageReady, false);
      await assert.rejects(upload(admin, customerId), storage.StorageNotConfiguredError);
    } finally {
      storage.setStorageForTests(store);
    }
  });
});
