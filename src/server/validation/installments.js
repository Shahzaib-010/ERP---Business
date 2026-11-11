import "server-only";
import { z } from "zod";
import { normalizeCnic } from "@/lib/cnic";
import { parseDateOnly, todayPk } from "@/lib/business-date";
import { FREQUENCIES } from "@/lib/installment-schedule";
import { normalizePhone } from "@/server/validation/customers";

// Money is whole rupees. Forms may send "155,000" or "155000"; commas and spaces are ignored.
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

const optionalInt = (min, max, message) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v, ctx) => {
      const s = String(v ?? "").trim();
      if (s === "") return undefined;
      const n = Number(s);
      if (!Number.isInteger(n) || n < min || n > max) {
        ctx.addIssue({ code: "custom", message });
        return z.NEVER;
      }
      return n;
    });

const businessDate = (label, { notFuture = true } = {}) =>
  z.string({ error: `Enter the ${label}.` }).transform((s, ctx) => {
    const d = parseDateOnly(s);
    if (!d) {
      ctx.addIssue({ code: "custom", message: `Enter a valid ${label}.` });
      return z.NEVER;
    }
    if (notFuture && s > todayPk()) {
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

const guarantorSchema = z.object({
  name: z.string().trim().max(100).optional().default(""),
  fatherName: optionalText(100),
  cnic: z
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
  profession: optionalText(100),
  address: optionalText(300),
  phone: z
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
});

export const scheduleSchema = z
  .object({
    frequency: z.enum(FREQUENCIES, { error: "Choose how often they pay." }),
    intervalDays: optionalInt(1, 365, "Between 1 and 365 days."),
    dueDayOfMonth: optionalInt(1, 31, "A day between 1 and 31."),
    installmentAmount: rupees("installment amount", { min: 1 }),
    firstDueDate: z
      .string()
      .optional()
      .transform((s, ctx) => {
        if (!s) return undefined;
        const d = parseDateOnly(s);
        if (!d) {
          ctx.addIssue({ code: "custom", message: "Enter a valid date." });
          return z.NEVER;
        }
        return d;
      }),
  })
  .superRefine((v, ctx) => {
    if (v.frequency === "custom" && !v.intervalDays) {
      ctx.addIssue({ code: "custom", path: ["intervalDays"], message: "How many days between payments?" });
    }
    if (v.frequency === "monthly" && !v.dueDayOfMonth) {
      ctx.addIssue({ code: "custom", path: ["dueDayOfMonth"], message: "Which day of the month is it due?" });
    }
    if (v.installmentAmount && !v.firstDueDate) {
      ctx.addIssue({ code: "custom", path: ["firstDueDate"], message: "When is the first installment due?" });
    }
  })
  .transform((v) => ({
    frequency: v.frequency,
    intervalDays: v.frequency === "custom" ? v.intervalDays : undefined,
    dueDayOfMonth: v.frequency === "monthly" ? v.dueDayOfMonth : undefined,
    installmentAmount: v.installmentAmount,
    firstDueDate: v.firstDueDate,
  }));

export const createPlanSchema = z
  .object({
    customerId: z.string({ error: "Choose the customer." }).min(1, "Choose the customer."),
    accountNumber: optionalInt(1, 9_999_999, "A whole number above 0."),
    previousAccountNumber: optionalInt(1, 9_999_999, "A whole number above 0."),
    agreementDate: businessDate("agreement date"),
    itemKind: z.enum(["bike", "mobile", "appliance", "other"], { error: "Choose the type of item." }),
    itemDescription: z.string().trim().min(2, "Describe the item.").max(200),
    itemModel: optionalText(100),
    itemSerial: optionalText(100),
    cashPrice: rupees("cash price"),
    agreedTotal: rupees("total price", { required: true, min: 1 }),
    advanceAmount: rupees("advance").transform((v) => v ?? 0),
    advanceReceiptNumber: optionalInt(1, 9_999_999, "A whole number above 0."),
    schedule: scheduleSchema,
    guarantors: z.array(guarantorSchema).max(10).default([]),
    notes: optionalText(2000),
  })
  .superRefine((v, ctx) => {
    if (v.cashPrice !== undefined && v.cashPrice > v.agreedTotal) {
      ctx.addIssue({ code: "custom", path: ["cashPrice"], message: "The cash price cannot be more than the total price." });
    }
    if (v.advanceAmount > v.agreedTotal) {
      ctx.addIssue({ code: "custom", path: ["advanceAmount"], message: "The advance cannot be more than the total price." });
    }
    if (v.advanceAmount < v.agreedTotal && !v.schedule.installmentAmount) {
      ctx.addIssue({ code: "custom", path: ["schedule", "installmentAmount"], message: "Enter the installment amount." });
    }
    if (v.schedule.firstDueDate && v.schedule.firstDueDate < v.agreementDate) {
      ctx.addIssue({ code: "custom", path: ["schedule", "firstDueDate"], message: "Cannot be before the agreement date." });
    }
    v.guarantors.forEach((g, i) => {
      const filled = g.fatherName || g.cnic || g.profession || g.address || g.phone;
      if (!g.name && filled) ctx.addIssue({ code: "custom", path: ["guarantors", i, "name"], message: "Enter the guarantor's name." });
    });
  })
  .transform((v) => ({ ...v, guarantors: v.guarantors.filter((g) => g.name) }));

export const updatePlanDetailsSchema = z.object({
  previousAccountNumber: optionalInt(1, 9_999_999, "A whole number above 0."),
  itemKind: z.enum(["bike", "mobile", "appliance", "other"], { error: "Choose the type of item." }),
  itemDescription: z.string().trim().min(2, "Describe the item.").max(200),
  itemModel: optionalText(100),
  itemSerial: optionalText(100),
  guarantors: z.array(guarantorSchema).max(10).default([]),
  notes: optionalText(2000),
});

export const paymentSchema = z.object({
  amount: rupees("amount", { required: true, min: 1 }),
  paidAt: businessDate("payment date"),
  receiptNumber: optionalInt(1, 9_999_999, "A whole number above 0."),
  note: optionalText(500),
});

export const discountSchema = z.object({
  reason: z.string().trim().min(3, "Give the reason for the discount.").max(500),
  paidAt: businessDate("date"),
});

export const voidSchema = z.object({
  reason: z.string().trim().min(3, "Give the reason.").max(500),
});

export const planListSchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  status: z.enum(["all", "active", "late", "completed"]).catch("all").default("all"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
});
