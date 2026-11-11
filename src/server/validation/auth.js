import "server-only";
import { z } from "zod";
import { ROLES } from "@/lib/permissions-catalog";

// bcrypt only reads the first 72 bytes, so longer passwords are refused rather than truncated.
export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .refine((s) => new TextEncoder().encode(s).length <= 72, "Password is too long.");

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9._-]{3,40}$/, "3–40 characters: letters, digits, dot, dash or underscore.");

export const staffLoginSchema = z.object({
  username: z.string().trim().toLowerCase().min(1, "Enter your username.").max(40),
  password: z.string().min(1, "Enter your password.").max(200),
});

export const customerLoginSchema = z.object({
  cnic: z.string().trim().min(1, "Enter your CNIC number.").max(20),
  password: z.string().min(1, "Enter your password.").max(200),
});

export const nameSchema = z.string().trim().min(2, "Enter a name.").max(100);

export const createStaffSchema = z.object({
  name: nameSchema,
  username: usernameSchema,
  role: z.enum(ROLES.filter((r) => r !== "superadmin"), { error: "Choose Admin or User." }),
  password: passwordSchema,
  permissions: z.array(z.string()).default([]),
});

export const updateStaffSchema = z.object({
  name: nameSchema,
  role: z.enum(ROLES.filter((r) => r !== "superadmin"), { error: "Choose Admin or User." }),
  permissions: z.array(z.string()).default([]),
  isActive: z.boolean(),
});

export const resetPasswordSchema = z.object({ password: passwordSchema });

export const changeOwnPasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    message: "The two new passwords do not match.",
    path: ["confirmPassword"],
  });

export const superadminSetupSchema = z.object({
  name: nameSchema,
  username: usernameSchema,
  password: passwordSchema,
});
