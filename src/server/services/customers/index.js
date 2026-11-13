import "server-only";
import mongoose from "mongoose";
import { connectDB, withTransaction } from "@/server/db/mongoose";
import { Customer } from "@/server/models/Customer";
import { CustomerCredential } from "@/server/models/CustomerCredential";
import { ConflictError, NotFoundError, parseOrThrow } from "@/server/errors";
import { requirePermission } from "@/server/permissions";
import { customerListSchema, customerSchema } from "@/server/validation/customers";
import { recordAudit } from "@/server/services/audit";
import { formatCnic, maskCnic } from "@/lib/cnic";

// Customer records (roadmap Phase 2). Customers are never deleted (D-007).

export const CUSTOMER_PAGE_SIZE = 25;

const EDITABLE_FIELDS = [
  "name",
  "fatherOrHusbandName",
  "caste",
  "profession",
  "designation",
  "phones",
  "whatsapp",
  "homeAddress",
  "collectionAddress",
  "businessAddress",
  "notes",
];

const DUPLICATE_CNIC = () =>
  new ConflictError("A customer with this CNIC already exists.", {
    cnic: "Already registered to another customer. Search for it instead.",
  });

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Turn what staff typed into a Mongo filter.
 *  - 3+ digits (dashes and spaces ignored): part of a CNIC or phone number.
 *    "+92 300…" also matches "0300…".
 *  - Anything else: part of the name or father's/husband's name, any case.
 * Returns null when there is nothing to search for.
 */
export function customerSearchFilter(raw) {
  const q = (raw ?? "").trim();
  if (!q) return null;

  if (/^[\d\s\-+()]+$/.test(q)) {
    const digits = q.replace(/\D/g, "");
    if (digits.length < 3) return null;
    const variants = [digits];
    if (digits.startsWith("92") && digits.length >= 5) variants.push(`0${digits.slice(2)}`);
    return {
      $or: variants.flatMap((d) => [
        { cnicNormalized: { $regex: escapeRegex(d) } },
        { phones: { $regex: escapeRegex(d) } },
        { whatsapp: { $regex: escapeRegex(d) } },
      ]),
    };
  }

  if (q.length < 2) return null;
  const re = { $regex: escapeRegex(q), $options: "i" };
  return { $or: [{ name: re }, { fatherOrHusbandName: re }] };
}

function assertObjectId(id) {
  if (!mongoose.isValidObjectId(id)) throw new NotFoundError("Customer not found.");
}

/** For lists and search results: the CNIC is masked. */
export function toListItem(c) {
  return {
    id: String(c._id),
    name: c.name,
    fatherOrHusbandName: c.fatherOrHusbandName ?? "",
    cnicMasked: maskCnic(c.cnicNormalized),
    phones: c.phones ?? [],
    whatsapp: c.whatsapp ?? "",
    collectionAddress: c.collectionAddress ?? "",
    portalEnabled: Boolean(c.portalEnabled),
    createdAt: c.createdAt ?? null,
  };
}

/** For the profile and edit form: staff with customers.view see the full CNIC (D-007). */
function toDetail(c) {
  return {
    ...toListItem(c),
    cnic: formatCnic(c.cnicNormalized),
    caste: c.caste ?? "",
    profession: c.profession ?? "",
    designation: c.designation ?? "",
    homeAddress: c.homeAddress ?? "",
    businessAddress: c.businessAddress ?? "",
    notes: c.notes ?? "",
    updatedAt: c.updatedAt ?? null,
  };
}

function auditSnapshot(c) {
  const out = { cnicNormalized: c.cnicNormalized };
  for (const key of EDITABLE_FIELDS) {
    const v = c[key];
    out[key] = Array.isArray(v) ? [...v] : (v ?? null);
  }
  return out;
}

export async function listCustomers(actor, input = {}) {
  requirePermission(actor, "customers.view");
  const { q, page } = parseOrThrow(customerListSchema, input);
  await connectDB();

  const filter = q ? customerSearchFilter(q) : {};
  if (filter === null) return { items: [], total: 0, page: 1, pageCount: 1, q };

  const total = await Customer.countDocuments(filter);
  const pageCount = Math.max(1, Math.ceil(total / CUSTOMER_PAGE_SIZE));
  const current = Math.min(page, pageCount);
  const rows = await Customer.find(filter)
    .sort(q ? { name: 1, _id: 1 } : { createdAt: -1, _id: -1 })
    .skip((current - 1) * CUSTOMER_PAGE_SIZE)
    .limit(CUSTOMER_PAGE_SIZE)
    .lean();

  return { items: rows.map(toListItem), total, page: current, pageCount, q };
}

/** The newest customers, newest first: shown in pickers before anything is typed. */
export async function recentCustomers(actor, { limit = 4 } = {}) {
  requirePermission(actor, "customers.view");
  await connectDB();
  const n = Math.min(Math.max(Number(limit) || 4, 1), 10);
  const rows = await Customer.find().sort({ createdAt: -1, _id: -1 }).limit(n).lean();
  return rows.map(toListItem);
}

/** Quick lookup for the universal search box. */
export async function searchCustomers(actor, q, { limit = 10 } = {}) {
  requirePermission(actor, "customers.view");
  const filter = customerSearchFilter(q);
  if (!filter) return [];
  await connectDB();
  const rows = await Customer.find(filter).sort({ name: 1, _id: 1 }).limit(limit).lean();
  return rows.map(toListItem);
}

export async function getCustomer(actor, id) {
  requirePermission(actor, "customers.view");
  assertObjectId(id);
  await connectDB();
  const c = await Customer.findById(id).lean();
  if (!c) throw new NotFoundError("Customer not found.");

  const cred = await CustomerCredential.findOne({ customerId: c._id })
    .select("isActive lastLoginAt passwordChangedAt")
    .lean();
  return {
    ...toDetail(c),
    portal: {
      enabled: Boolean(c.portalEnabled),
      hasPassword: Boolean(cred),
      lastLoginAt: cred?.lastLoginAt ?? null,
    },
  };
}

export async function createCustomer(actor, input) {
  requirePermission(actor, "customers.create");
  const data = parseOrThrow(customerSchema, input);
  await connectDB();

  try {
    return await withTransaction(async (session) => {
      const doc = { createdBy: actor.id, cnicNormalized: data.cnic };
      for (const key of EDITABLE_FIELDS) if (data[key] !== undefined) doc[key] = data[key];
      const [c] = await Customer.create([doc], { session });
      await recordAudit(
        {
          actor,
          action: "customer.create",
          entityType: "customer",
          entityId: c._id,
          after: auditSnapshot(c),
        },
        session,
      );
      return { id: String(c._id) };
    });
  } catch (err) {
    if (err?.code === 11000) throw DUPLICATE_CNIC();
    throw err;
  }
}

export async function updateCustomer(actor, id, input) {
  requirePermission(actor, "customers.edit");
  assertObjectId(id);
  const data = parseOrThrow(customerSchema, input);
  await connectDB();

  try {
    return await withTransaction(async (session) => {
      const c = await Customer.findById(id).session(session);
      if (!c) throw new NotFoundError("Customer not found.");
      const before = auditSnapshot(c);

      c.cnicNormalized = data.cnic;
      // Empty optional fields are cleared, not left at their old value.
      for (const key of EDITABLE_FIELDS) c[key] = data[key] ?? (key === "phones" ? [] : undefined);
      const after = auditSnapshot(c);
      if (JSON.stringify(before) === JSON.stringify(after)) return { id: String(c._id), changed: false };

      await c.save({ session });
      await recordAudit(
        {
          actor,
          action: "customer.update",
          entityType: "customer",
          entityId: c._id,
          before,
          after,
        },
        session,
      );
      return { id: String(c._id), changed: true };
    });
  } catch (err) {
    if (err?.code === 11000) throw DUPLICATE_CNIC();
    throw err;
  }
}
