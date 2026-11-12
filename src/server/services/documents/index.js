import "server-only";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";
import { connectDB } from "@/server/db/mongoose";
import { Document } from "@/server/models/Document";
import { Customer } from "@/server/models/Customer";
import { InstallmentPlan } from "@/server/models/InstallmentPlan";
import { Bike } from "@/server/models/Bike";
import { NotFoundError, ValidationError, parseOrThrow } from "@/server/errors";
import { can, requirePermission } from "@/server/permissions";
import { recordAudit } from "@/server/services/audit";
import { getStorage, isStorageConfigured } from "@/server/storage";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_OWNERS,
  DOCUMENT_TYPES,
  MAX_DOCUMENT_BYTES,
  extensionOf,
  formatFileSize,
} from "@/lib/documents";

// Private documents on customers, installment plans and bikes (Phase 6, D-017).
// - Staff only. Customers (portal) never reach any of this: every function needs a staff
//   permission, and requirePermission refuses customer actors.
// - Upload: startUpload() returns a short-lived signed PUT URL; the browser uploads straight
//   to storage; confirmUpload() checks size and the real file signature before listing it.
// - Removal is a bin (restore possible). Permanent erase is a separate, deliberate step.
//   Both need the opt-in "documents.remove" permission (Superadmin by default).

const OWNER_MODELS = { customer: Customer, plan: InstallmentPlan, bike: Bike };
const AUDIT_ENTITY = { customer: "customer", plan: "installmentPlan", bike: "bike" };
const CATEGORY_VALUES = DOCUMENT_CATEGORIES.map((c) => c.value);

const ownerSchema = z.object({
  ownerType: z.enum(["customer", "plan", "bike"], { error: "Unknown record type." }),
  ownerId: z.string().refine((v) => mongoose.isValidObjectId(v), "Unknown record."),
});

const startSchema = ownerSchema.extend({
  category: z.enum(CATEGORY_VALUES, { error: "Choose a document group." }),
  label: z.string().trim().min(1, "Give the document a label.").max(120, "Keep the label under 120 characters."),
  fileName: z.string().trim().min(1, "Choose a file.").max(200, "The file name is too long."),
  mimeType: z.string(),
  size: z.coerce.number().int().positive("The file is empty."),
});

const reasonSchema = z.object({
  reason: z.string().trim().min(3, "Say briefly why (at least 3 characters).").max(500),
});

/** File signatures ("magic bytes"): the first bytes of each allowed type. */
function matchesSignature(mimeType, b) {
  const starts = (...bytes) => bytes.every((x, i) => b[i] === x);
  switch (mimeType) {
    case "application/pdf":
      return starts(0x25, 0x50, 0x44, 0x46); // %PDF
    case "image/png":
      return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
    case "image/jpeg":
      return starts(0xff, 0xd8, 0xff);
    case "image/webp":
      return starts(0x52, 0x49, 0x46, 0x46) && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50; // RIFF....WEBP
    default:
      return false;
  }
}

function requireOwnerAccess(actor, ownerType, permission) {
  requirePermission(actor, permission);
  requirePermission(actor, DOCUMENT_OWNERS[ownerType].viewPermission);
}

async function assertOwnerExists(ownerType, ownerId) {
  const exists = await OWNER_MODELS[ownerType].exists({ _id: ownerId });
  if (!exists) throw new NotFoundError(`${DOCUMENT_OWNERS[ownerType].label} not found.`);
}

function toPublic(doc) {
  return {
    id: String(doc._id),
    ownerType: doc.ownerType,
    ownerId: String(doc.ownerId),
    category: doc.category,
    label: doc.label,
    fileName: doc.originalName,
    mimeType: doc.mimeType,
    size: doc.size,
    status: doc.status,
    isImage: doc.mimeType.startsWith("image/"),
    uploadedAt: doc.confirmedAt ?? doc.createdAt,
    uploadedByName: doc.uploadedBy?.name ?? null,
    removedAt: doc.removedAt ?? null,
    removedByName: doc.removedBy?.name ?? null,
    removeReason: doc.removeReason ?? null,
    // Never: storageKey or any URL.
  };
}

function auditDetails(doc) {
  return { label: doc.label, category: doc.category, fileName: doc.originalName, size: formatFileSize(doc.size) };
}

async function audit(actor, action, doc, extra = {}, scope = "operational") {
  await recordAudit({
    actor,
    action,
    scope,
    entityType: AUDIT_ENTITY[doc.ownerType],
    entityId: doc.ownerId,
    after: { ...auditDetails(doc), ...extra },
  });
}

/** What the Documents section on a record page needs: the list, the bin and what you may do. */
export async function listDocuments(actor, input) {
  const { ownerType, ownerId } = parseOrThrow(ownerSchema, input);
  requireOwnerAccess(actor, ownerType, "documents.view");
  await connectDB();
  const canRemove = can(actor, "documents.remove");
  const statuses = canRemove ? ["active", "removed"] : ["active"];
  const docs = await Document.find({ ownerType, ownerId, status: { $in: statuses } })
    .sort({ createdAt: -1 })
    .populate("uploadedBy", "name")
    .populate("removedBy", "name")
    .lean();
  const all = docs.map(toPublic);
  return {
    storageReady: isStorageConfigured(),
    canUpload: can(actor, "documents.upload"),
    canRemove,
    documents: all.filter((d) => d.status === "active"),
    bin: all.filter((d) => d.status === "removed"),
  };
}

/**
 * Step 1 of an upload: check the request and return a signed URL the browser PUTs the file
 * to. The document stays "pending" (unlisted) until confirmUpload() has checked the file.
 */
export async function startUpload(actor, input) {
  const data = parseOrThrow(startSchema, input);
  requireOwnerAccess(actor, data.ownerType, "documents.upload");

  const allowedExts = DOCUMENT_TYPES[data.mimeType];
  if (!allowedExts) throw new ValidationError("Only PDF, JPG, PNG or WEBP files can be uploaded.", { file: "Not an allowed file type." });
  if (!allowedExts.includes(extensionOf(data.fileName))) {
    throw new ValidationError("The file name does not match its type.", { file: "Use a .pdf, .jpg, .png or .webp file." });
  }
  if (data.size > MAX_DOCUMENT_BYTES) {
    throw new ValidationError(`Files can be at most ${formatFileSize(MAX_DOCUMENT_BYTES)}.`, { file: "This file is too large." });
  }

  const storage = getStorage(); // fails early with a clear message if storage is not set up
  await connectDB();
  await assertOwnerExists(data.ownerType, data.ownerId);

  // Random key; no names, CNICs or record ids in the path.
  const storageKey = `documents/${randomBytes(16).toString("hex")}.${allowedExts[0]}`;
  const doc = await Document.create({
    ownerType: data.ownerType,
    ownerId: data.ownerId,
    category: data.category,
    label: data.label,
    originalName: data.fileName,
    mimeType: data.mimeType,
    size: data.size,
    storageKey,
    uploadedBy: actor.id,
  });
  const uploadUrl = await storage.presignPut(storageKey, { contentType: data.mimeType });
  return { documentId: String(doc._id), uploadUrl, contentType: data.mimeType };
}

/**
 * Step 2 of an upload: the browser says it has finished. The stored object must exist,
 * be within the limit, match the declared size and start with the right file signature.
 * Anything else is deleted from storage and refused.
 */
export async function confirmUpload(actor, documentId) {
  requirePermission(actor, "documents.upload");
  if (!mongoose.isValidObjectId(documentId)) throw new NotFoundError("Document not found.");
  await connectDB();
  const doc = await Document.findOne({ _id: documentId, status: "pending" });
  if (!doc || String(doc.uploadedBy) !== actor.id) throw new NotFoundError("Document not found.");
  requireOwnerAccess(actor, doc.ownerType, "documents.upload");

  const storage = getStorage();
  const stored = await storage.head(doc.storageKey);
  const reject = async (message) => {
    await storage.remove(doc.storageKey).catch(() => {});
    await Document.deleteOne({ _id: doc._id, status: "pending" }); // never listed, nothing to keep
    throw new ValidationError(message, { file: message });
  };
  if (!stored) await reject("The upload did not finish. Please try again.");
  if (stored.size > MAX_DOCUMENT_BYTES) await reject(`Files can be at most ${formatFileSize(MAX_DOCUMENT_BYTES)}.`);
  if (stored.size !== doc.size) await reject("The uploaded file is not the one that was chosen. Please try again.");
  const head = await storage.readStart(doc.storageKey, 16);
  if (!matchesSignature(doc.mimeType, head)) await reject("This file is not a real PDF, JPG, PNG or WEBP file.");

  doc.status = "active";
  doc.confirmedAt = new Date();
  await doc.save();
  await audit(actor, "document.upload", doc);
  return toPublic(doc);
}

async function loadForAccess(actor, documentId, statuses) {
  if (!mongoose.isValidObjectId(documentId)) throw new NotFoundError("Document not found.");
  await connectDB();
  const doc = await Document.findOne({ _id: documentId, status: { $in: statuses } });
  if (!doc) throw new NotFoundError("Document not found.");
  return doc;
}

/**
 * A signed URL that shows (or downloads) the file for 60 seconds. Every open is written to
 * the audit log (security scope: visible to the Superadmin). The URL itself is never logged.
 */
export async function getDocumentUrl(actor, documentId, { download = false } = {}) {
  requirePermission(actor, "documents.view");
  const statuses = can(actor, "documents.remove") ? ["active", "removed"] : ["active"];
  const doc = await loadForAccess(actor, documentId, statuses);
  requireOwnerAccess(actor, doc.ownerType, "documents.view");
  const url = await getStorage().presignGet(doc.storageKey, {
    fileName: doc.originalName,
    contentType: doc.mimeType,
    download,
    expiresIn: 60,
  });
  await audit(actor, "document.view", doc, { download }, "security");
  return url;
}

/** Move a document to the bin. The file stays in storage and can be restored. */
export async function removeDocument(actor, documentId, input) {
  requirePermission(actor, "documents.remove");
  const { reason } = parseOrThrow(reasonSchema, input);
  const doc = await loadForAccess(actor, documentId, ["active"]);
  requireOwnerAccess(actor, doc.ownerType, "documents.remove");
  doc.status = "removed";
  doc.removedAt = new Date();
  doc.removedBy = actor.id;
  doc.removeReason = reason;
  await doc.save();
  await audit(actor, "document.remove", doc, { reason });
  return toPublic(doc);
}

export async function restoreDocument(actor, documentId) {
  requirePermission(actor, "documents.remove");
  const doc = await loadForAccess(actor, documentId, ["removed"]);
  requireOwnerAccess(actor, doc.ownerType, "documents.remove");
  doc.status = "active";
  doc.removedAt = undefined;
  doc.removedBy = undefined;
  doc.removeReason = undefined;
  await doc.save();
  await audit(actor, "document.restore", doc);
  return toPublic(doc);
}

/**
 * Permanently delete the file from storage. Only from the bin, so it always takes two
 * deliberate steps. The metadata row stays (status "erased") as the audit trail.
 */
export async function eraseDocument(actor, documentId, input) {
  requirePermission(actor, "documents.remove");
  const { reason } = parseOrThrow(reasonSchema, input);
  const doc = await loadForAccess(actor, documentId, ["removed"]);
  requireOwnerAccess(actor, doc.ownerType, "documents.remove");
  await getStorage().remove(doc.storageKey);
  doc.status = "erased";
  doc.erasedAt = new Date();
  doc.erasedBy = actor.id;
  await doc.save();
  await audit(actor, "document.erase", doc, { reason });
  return { id: String(doc._id), status: doc.status };
}
