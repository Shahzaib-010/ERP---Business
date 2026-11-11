import "server-only";
import { z } from "zod";

const schema = z.object({
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, "MONGODB_URI must be a MongoDB connection string"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  APP_TIMEZONE: z.string().default("Asia/Karachi"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

let cached;

/**
 * Validated server environment. Validation runs on first use, not at import time,
 * so `next build` works without secrets present.
 */
export function getEnv() {
  if (cached) return cached;
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const problems = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${problems}\nSee .env.example.`);
  }
  cached = result.data;
  return cached;
}
