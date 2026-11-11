import "server-only";
import mongoose from "mongoose";

// One row per signed-in browser. The cookie holds a random token; this row holds only its
// keyed hash. Deleting the row signs the browser out immediately.
const sessionSchema = new mongoose.Schema(
  {
    tokenHash: { type: String, required: true },
    kind: { type: String, enum: ["staff", "customer"], required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, required: true },
    expiresAt: { type: Date, required: true },
    userAgent: { type: String, maxlength: 300 },
  },
  { timestamps: true, collection: "sessions" },
);

sessionSchema.index({ tokenHash: 1 }, { unique: true });
sessionSchema.index({ kind: 1, subjectId: 1 });
// MongoDB removes expired sessions automatically.
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Session = mongoose.models.Session ?? mongoose.model("Session", sessionSchema);
