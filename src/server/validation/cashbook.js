import "server-only";
import { z } from "zod";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PERIODS } from "@/lib/cashbook";
import { parseDateOnly, todayPk } from "@/lib/business-date";

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters.`)
    .optional()
    .transform((s) => (s ? s : undefined));

export const transactionSchema = z
  .object({
    type: z.enum(["expense", "other_income", "owner_investment", "owner_withdrawal"], { error: "Choose the type of entry." }),
    category: z.string().optional(),
    amount: z.union([z.string(), z.number()]).transform((v, ctx) => {
      const s = typeof v === "number" ? String(v) : String(v ?? "").replace(/[,\s]/g, "");
      if (!s) {
        ctx.addIssue({ code: "custom", message: "Enter the amount." });
        return z.NEVER;
      }
      if (!/^\d+$/.test(s) || Number(s) < 1) {
        ctx.addIssue({ code: "custom", message: "Use whole rupees above 0." });
        return z.NEVER;
      }
      if (Number(s) > 100_000_000) {
        ctx.addIssue({ code: "custom", message: "That amount is too large." });
        return z.NEVER;
      }
      return Number(s);
    }),
    occurredAt: z.string({ error: "Enter the date." }).transform((s, ctx) => {
      const d = parseDateOnly(s);
      if (!d) {
        ctx.addIssue({ code: "custom", message: "Enter a valid date." });
        return z.NEVER;
      }
      if (s > todayPk()) {
        ctx.addIssue({ code: "custom", message: "Cannot be in the future." });
        return z.NEVER;
      }
      return d;
    }),
    description: z.string().trim().min(2, "Say what it was for.").max(300),
    party: optionalText(100),
    voucherNumber: optionalText(30),
  })
  .superRefine((v, ctx) => {
    if (v.type === "expense" && !EXPENSE_CATEGORIES.some((c) => c.value === v.category)) {
      ctx.addIssue({ code: "custom", path: ["category"], message: "Choose a category." });
    }
    if (v.type === "other_income" && !INCOME_CATEGORIES.some((c) => c.value === v.category)) {
      ctx.addIssue({ code: "custom", path: ["category"], message: "Choose a category." });
    }
  })
  .transform((v) => ({ ...v, category: v.type === "expense" || v.type === "other_income" ? v.category : undefined }));

export const voidTransactionSchema = z.object({
  reason: z.string().trim().min(3, "Give the reason.").max(500),
});

export const cashbookListSchema = z.object({
  period: z.enum(PERIODS.map((p) => p.value)).catch("month").default("month"),
  direction: z.enum(["all", "in", "out"]).catch("all").default("all"),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
});

export const periodSchema = z.enum(PERIODS.map((p) => p.value)).catch("month");
