// Starts a throw-away single-node MongoDB replica set (transactions need a replica set).
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

export async function startTestDb() {
  const repl = await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } });
  process.env.MONGODB_URI = repl.getUri("bike_test");
  process.env.SESSION_SECRET = "test-secret-that-is-at-least-32-characters-long";
  process.env.NODE_ENV = "test";

  const { connectDB } = await import("@/server/db/mongoose");
  await import("@/server/models/StaffUser");
  await import("@/server/models/Customer");
  await import("@/server/models/CustomerCredential");
  await import("@/server/models/Session");
  await import("@/server/models/LoginThrottle");
  await import("@/server/models/AuditLog");
  await connectDB();
  // Build unique indexes before tests rely on them.
  for (const model of Object.values(mongoose.models)) await model.init();

  return {
    async stop() {
      await mongoose.disconnect();
      await repl.stop();
    },
  };
}
