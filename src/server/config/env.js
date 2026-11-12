import "server-only";
import { z } from "zod";

const schema = z.object({
  MONGODB_URI: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, "MONGODB_URI must be a MongoDB connection string"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  APP_TIMEZONE: z.string().default("Asia/Karachi"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Private file storage (Cloudflare R2 or Backblaze B2, S3 API). Optional: without it the
  // app runs and the Documents sections say that storage is not set up.
  S3_ENDPOINT: optional(z.url()),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: optional(z.string()),
  S3_ACCESS_KEY_ID: optional(z.string()),
  S3_SECRET_ACCESS_KEY: optional(z.string()),
});

// An empty value ("S3_BUCKET=") counts as not set.
function optional(type) {
  return z.preprocess((v) => (v === "" ? undefined : v), type.optional());
}

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
