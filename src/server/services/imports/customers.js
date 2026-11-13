import "server-only";
import { z } from "zod";
import { connectDB } from "@/server/db/mongoose";
import { Customer } from "@/server/models/Customer";
import { ConflictError, ValidationError, zodFieldErrors } from "@/server/errors";
import { requirePermission } from "@/server/permissions";
import { createCustomer } from "@/server/services/customers";
import { customerSchema } from "@/server/validation/customers";
import { CUSTOMER_IMPORT_FIELDS, IMPORT_CHUNK, IMPORT_MAX_ROWS } from "@/lib/imports";

// Customer import from a spreadsheet. The browser reads the file and matches the columns;
// this service checks every row with the same rules as the "Add customer" form and saves
// the good ones through createCustomer() (so each one is audited). Rows whose CNIC already
// exists, or appears twice in the file, are skipped, never overwritten.

const textRow = z.object(Object.fromEntries(CUSTOMER_IMPORT_FIELDS.map((f) => [f.key, z.string().max(1000).optional().default("")])));
const rowsSchema = z.array(textRow).min(1, "The file has no rows.").max(IMPORT_MAX_ROWS, `At most ${IMPORT_MAX_ROWS} rows per import.`);

const FIELD_LABELS = Object.fromEntries(CUSTOMER_IMPORT_FIELDS.map((f) => [f.key, f.label]));
FIELD_LABELS.phones = "Phone";

function toInput(r) {
  const input = { phones: [r.phone1, r.phone2, r.phone3].filter(Boolean) };
  for (const f of CUSTOMER_IMPORT_FIELDS) if (!f.key.startsWith("phone") && r[f.key]) input[f.key] = r[f.key];
  return input;
}

function parseRows(rows) {
  const parsed = rowsSchema.safeParse(rows);
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "The file could not be read.");
  return parsed.data;
}

/** Check rows without saving: status per row ("ready" | "duplicate" | "error") and totals. */
async function checkRows(rows) {
  const results = rows.map((r, i) => {
    const res = customerSchema.safeParse(toInput(r));
    if (!res.success) {
      const errors = Object.entries(zodFieldErrors(res.error)).map(([k, msg]) => `${FIELD_LABELS[k.split(".")[0]] ?? k}: ${msg}`);
      return { row: i + 1, status: "error", errors, cnic: null, input: null };
    }
    return { row: i + 1, status: "ready", errors: [], cnic: res.data.cnic, input: toInput(r) };
  });

  const cnics = results.filter((r) => r.cnic).map((r) => r.cnic);
  const existing = cnics.length ? await Customer.find({ cnicNormalized: { $in: cnics } }).select("cnicNormalized name").lean() : [];
  const existingByCnic = new Map(existing.map((c) => [c.cnicNormalized, c]));
  const firstRow = new Map();
  for (const r of results) {
    if (r.status !== "ready") continue;
    const found = existingByCnic.get(r.cnic);
    if (found) {
      r.status = "duplicate";
      r.errors = [`Already a customer: ${found.name}`];
      r.existingId = String(found._id);
    } else if (firstRow.has(r.cnic)) {
      r.status = "duplicate";
      r.errors = [`Same CNIC as row ${firstRow.get(r.cnic)} in this file`];
    } else {
      firstRow.set(r.cnic, r.row);
    }
  }
  return results;
}

const summarize = (results) => ({
  total: results.length,
  ready: results.filter((r) => r.status === "ready").length,
  duplicates: results.filter((r) => r.status === "duplicate").length,
  errors: results.filter((r) => r.status === "error").length,
});

export async function checkCustomerImport(actor, rows) {
  requirePermission(actor, "customers.create");
  const data = parseRows(rows);
  await connectDB();
  const results = await checkRows(data);
  return {
    summary: summarize(results),
    // No CNICs go back to the browser beyond what it sent; only row status and messages.
    rows: results.map(({ row, status, errors, existingId }) => ({ row, status, errors, existingId: existingId ?? null })),
  };
}

/**
 * Save one chunk of rows (the browser sends the file in chunks of IMPORT_CHUNK). Each row
 * is re-checked here; only "ready" rows are created. `firstRow` is the chunk's row number
 * in the whole file, so messages point to the right line.
 */
export async function importCustomerChunk(actor, rows, { firstRow = 1 } = {}) {
  requirePermission(actor, "customers.create");
  const data = parseRows(rows);
  if (data.length > IMPORT_CHUNK) throw new ValidationError(`Send at most ${IMPORT_CHUNK} rows at a time.`);
  await connectDB();
  const results = await checkRows(data);

  const created = [];
  const skipped = [];
  for (const r of results) {
    const fileRow = firstRow + r.row - 1;
    if (r.status !== "ready") {
      skipped.push({ row: fileRow, status: r.status, message: r.errors.join("; ") });
      continue;
    }
    try {
      const c = await createCustomer(actor, r.input);
      created.push({ row: fileRow, id: c.id });
    } catch (err) {
      // A CNIC added by someone else a moment ago, or any other expected refusal.
      const message = err instanceof ConflictError || err instanceof ValidationError ? err.message : "Could not be saved.";
      if (!(err instanceof ConflictError || err instanceof ValidationError)) console.error("[import] customer row failed:", err?.name, err?.message);
      skipped.push({ row: fileRow, status: err instanceof ConflictError ? "duplicate" : "error", message });
    }
  }
  return { created: created.length, skipped };
}
