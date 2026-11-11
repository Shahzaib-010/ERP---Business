import "server-only";
import mongoose from "mongoose";
import { getEnv } from "@/server/config/env";

// Reuse one connection across hot reloads (dev) and warm serverless invocations (prod).
const globalCache = globalThis.__mongoose ?? (globalThis.__mongoose = { conn: null, promise: null });

export async function connectDB() {
  if (globalCache.conn) return globalCache.conn;

  if (!globalCache.promise) {
    const { MONGODB_URI } = getEnv();
    mongoose.set("strictQuery", true);
    globalCache.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
        maxPoolSize: 10,
        serverSelectionTimeoutMS: 10_000,
      })
      .catch((err) => {
        globalCache.promise = null; // allow a retry on the next request
        throw err;
      });
  }

  globalCache.conn = await globalCache.promise;
  return globalCache.conn;
}

/**
 * Run `fn(session)` inside a MongoDB transaction. Use this for financial writes
 * that touch more than one document (docs/02 §2.4). Atlas M0 supports transactions.
 */
export async function withTransaction(fn) {
  const conn = await connectDB();
  const session = await conn.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await fn(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
