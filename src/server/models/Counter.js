import "server-only";
import mongoose from "mongoose";

// Sequential numbers (account numbers, receipt numbers). `seq` is the highest number used so
// far, so paper numbers entered by hand push the series forward (D-006 answer 1).
const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // "accountNumber", "receiptNumber"
    seq: { type: Number, required: true, default: 0 },
  },
  { collection: "counters", versionKey: false },
);

export const Counter = mongoose.models.Counter ?? mongoose.model("Counter", counterSchema);
