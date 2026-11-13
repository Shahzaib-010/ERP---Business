import "server-only";
import { z } from "zod";
import { normalizeCnic } from "@/lib/cnic";

// Customer fields come from the paper agreement and ledger card (docs/07 §7.2, D-007).

const optionalText = (max) =>
  z
    .string()
    .trim()
    .max(max, `At most ${max} characters.`)
    .optional()
    .transform((s) => (s ? s : undefined));

export const MAX_PHONES = 3;

/** Digits only. Accepts "0300-1234567", "0300 1234567", "+92 300 1234567" kept as typed digits. */
export function normalizePhone(input) {
  return typeof input === "string" ? input.replace(/\D/g, "") : "";
}

const phonesSchema = z
  .array(z.string())
  .default([])
  .transform((list) => [...new Set(list.map(normalizePhone).filter(Boolean))])
  .pipe(
    z
      .array(z.string().regex(/^\d{7,15}$/, "A phone number has 7–15 digits."))
      .max(MAX_PHONES, `At most ${MAX_PHONES} phone numbers.`),
  );

export const customerSchema = z.object({
  name: z.string().trim().min(2, "Enter the customer's name.").max(100),
  fatherOrHusbandName: optionalText(100),
  caste: optionalText(60),
  profession: optionalText(100),
  designation: optionalText(100),
  cnic: z
    .string({ error: "Enter the CNIC number." })
    .transform((s, ctx) => {
      const digits = normalizeCnic(s);
      if (!digits) {
        ctx.addIssue({ code: "custom", message: "A CNIC has 13 digits, e.g. 31303-1234567-1." });
        return z.NEVER;
      }
      return digits;
    }),
  phones: phonesSchema,
  whatsapp: z
    .string()
    .optional()
    .transform((s) => normalizePhone(s ?? "") || undefined)
    .pipe(z.string().regex(/^\d{7,15}$/, "A WhatsApp number has 7–15 digits.").optional()),
  homeAddress: optionalText(300),
  collectionAddress: optionalText(300),
  businessAddress: optionalText(300),
  notes: optionalText(1000),
});

export const customerListSchema = z.object({
  q: z.string().trim().max(100).optional().default(""),
  page: z.coerce.number().int().min(1).max(10_000).catch(1).default(1),
});
