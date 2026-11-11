import "server-only";
import mongoose from "mongoose";

// Counts failed logins per key (hashed username, CNIC or IP) inside a time window.
// Stored in MongoDB, not memory, because serverless hosts run many short-lived instances.
const loginThrottleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    failures: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true },
  },
  { collection: "loginThrottles" },
);

loginThrottleSchema.index({ key: 1 }, { unique: true });
loginThrottleSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const LoginThrottle =
  mongoose.models.LoginThrottle ?? mongoose.model("LoginThrottle", loginThrottleSchema);
