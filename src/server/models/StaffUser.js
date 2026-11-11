import "server-only";
import mongoose from "mongoose";
import { ROLES } from "@/lib/permissions-catalog";

const staffUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    // Lower-case login name. Unique.
    username: { type: String, required: true, trim: true, lowercase: true, maxlength: 40 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true },
    // Only used for the "user" role. Admin and Superadmin permissions come from the role.
    permissions: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
    passwordChangedAt: { type: Date },
    lastLoginAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "StaffUser" },
  },
  { timestamps: true, collection: "staffUsers" },
);

staffUserSchema.index({ username: 1 }, { unique: true });
staffUserSchema.index({ role: 1 });

export const StaffUser = mongoose.models.StaffUser ?? mongoose.model("StaffUser", staffUserSchema);
