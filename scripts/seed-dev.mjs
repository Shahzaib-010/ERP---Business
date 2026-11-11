// Development only: adds a demo customer with a portal login, so the customer login can be
// tried before the customer screens exist (Phase 2).
//
//   npm run seed:dev
//
// Demo customer CNIC 11111-1111111-1, password "demo-pass-123". Refuses to run in production.
import mongoose from "mongoose";
import { connectDB } from "@/server/db/mongoose";
import { getEnv } from "@/server/config/env";
import { Customer } from "@/server/models/Customer";
import { StaffUser } from "@/server/models/StaffUser";
import { setCustomerPortalPassword } from "@/server/services/customers/portal-access";

async function main() {
  if (getEnv().NODE_ENV === "production") throw new Error("seed:dev must not run in production.");
  await connectDB();

  const superadmin = await StaffUser.findOne({ role: "superadmin" }).lean();
  if (!superadmin) throw new Error("Run `npm run create-superadmin` first.");
  const actor = { kind: "staff", id: String(superadmin._id), role: "superadmin", isActive: true };

  const customer = await Customer.findOneAndUpdate(
    { cnicNormalized: "1111111111111" },
    { $setOnInsert: { name: "Demo Customer", phones: ["03000000000"], createdBy: superadmin._id } },
    { upsert: true, returnDocument: "after" },
  );
  await setCustomerPortalPassword(actor, String(customer._id), { password: "demo-pass-123" });
  console.log('Demo customer ready: CNIC 11111-1111111-1, password "demo-pass-123".');
}

main()
  .catch((err) => {
    console.error(`Seed failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
