import "server-only";
import { z } from "zod";
import { normalizeCnic } from "@/lib/cnic";
import { parseDateOnly, todayPk } from "@/lib/business-date";
import { normalizePhone } from "@/server/validation/customers";

// Whole rupees; "155,000" and "155000" both work.
const rupees = (label, { required = false, min = 0 } = {}) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v, ctx) => {
      const s = typeof v === "number" ? String(v) : (v ?? "").replace(/[,\s]/g, "");
      if (s === "") {
        if (required) ctx.addIssue({ code: "custom", message: `Enter the ${label}.` });
        return required ? z.NEVER : undefined;
      }
      if (!/^\d+$/.test(s)) {
        ctx.addIssue({ code: "custom", message: "Use whole rupees, digits only." });
        return z.NEVER;
      }
      const n = Number(s);
      if (n < min) {
        ctx.addIssue({ code: "custom", message: min > 0 ? `Must be at least ${min}.` : "Cannot be negative." });
        return z.NEVER;
      }
      if (n > 100_000_000) {
        ctx.addIssue({ code: "custom", message: "That amount is too large." });
        return z.NEVER;
      }
      return n;
    });

const businessDate = (label) =>
  z.string({ error: `Enter the ${label}.` }).transform((s, ctx) => {
    const d = parseDateOnly(s);
    if (!d) {
      ctx.addIssue({ code: "custom", message: `Enter a valid ${label}.` });
      return z.NEVER;
    }
    if (s > todayPk()) {
      ctx.addIssue({ code: "custom", message: "Cannot be in the future." });
      return z.NEVER;
    }
    return d;
  });

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters.`)
    .optional()
    .transform((s) => (s ? s : undefined));

/** Registration, engine and chassis numbers: kept as typed (upper-case) for display. */
const identifier = (max) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters.`)
    .optional()
    .transform((s) => (s ? s.toUpperCase().replace(/\s+/g, " ") : undefined));

/** "BJJ-4802" / "bjj 4802" -> "BJJ4802", for duplicate checks and search. */
export function identifierKey(s) {
  const k = String(s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  return k || undefined;
}

const bikeFields = {
  make: z.string().trim().min(1, "Enter the make, e.g. Honda.").max(60),
  model: z.string().trim().min(1, "Enter the model, e.g. CD70.").max(80),
  modelYear: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v, ctx) => {
      const s = String(v ?? "").trim();
      if (!s) return undefined;
      const n = Number(s);
      if (!Number.isInteger(n) || n < 1950 || n > 2100) {
        ctx.addIssue({ code: "custom", message: "A year like 2026." });
        return z.NEVER;
      }
      return n;
    }),
  color: optionalText(40),
  condition: z.enum(["new", "used"], { error: "Choose new or used." }),
  registrationNumber: identifier(30),
  engineNumber: identifier(40),
  chassisNumber: identifier(40),
  notes: optionalText(2000),
  sellerName: z.string().trim().min(2, "Enter who the bike was bought from.").max(100),
  sellerPhone: z
    .string()
    .optional()
    .transform((s, ctx) => {
      const d = normalizePhone(s ?? "");
      if (!d) return undefined;
      if (!/^\d{7,15}$/.test(d)) {
        ctx.addIssue({ code: "custom", message: "A phone number has 7–15 digits." });
        return z.NEVER;
      }
      return d;
    }),
  sellerCnic: z
    .string()
    .optional()
    .transform((s, ctx) => {
      if (!s?.trim()) return undefined;
      const d = normalizeCnic(s);
      if (!d) {
        ctx.addIssue({ code: "custom", message: "A CNIC has 13 digits." });
        return z.NEVER;
      }
      return d;
    }),
  sellerAddress: optionalText(300),
};

export const bikePurchaseSchema = z
  .object({
    ...bikeFields,
    purchaseDate: businessDate("purchase date"),
    purchasePrice: rupees("purchase price", { required: true, min: 1 }),
    paidNow: rupees("amount paid").transform((v) => v ?? 0),
  })
  .superRefine((v, ctx) => {
    if (v.paidNow > v.purchasePrice) {
      ctx.addIssue({ code: "custom", path: ["paidNow"], message: "Cannot be more than the purchase price." });
    }
  });

export const bikeDetailsSchema = z.object(bikeFields);

export const sellerPaymentSchema = z.object({
  amount: rupees("amount", { required: true, min: 1 }),
  paidAt: businessDate("date"),
  note: optionalText(500),
});

export const cashSaleSchema = z.object({
  customerId: z.string({ error: "Choose the customer." }).min(1, "Choose the customer."),
  saleDate: businessDate("sale date"),
  salePrice: rupees("sale price", { required: true, min: 1 }),
  receiptNumber: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v, ctx) => {
      const s = String(v ?? "").trim();
      if (!s) return undefined;
      const n = Number(s);
      if (!Number.isInteger(n) || n < 1 || n > 9_999_999) {
        ctx.addIssue({ code: "custom", message: "A whole number above 0." });
        return z.NEVER;
      }
      return n;
    }),
  note: optionalText(500),
});

export const reasonSchema = z.object({
  reason: z.string().trim().min(3, "Give the reason.").max(500),
});

export const bikeListSchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  status: z.enum(["all", "in_stock", "sold", "owed"]).catch("in_stock").default("in_stock"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
});
