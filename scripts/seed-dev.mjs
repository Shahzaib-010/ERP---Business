// Development only: adds dummy customers so the screens can be tried before the paper
// records are entered (D-006 answer 3). One of them has a portal login.
//
//   npm run seed:dev
//
// Safe to run again: customers that already exist (same CNIC) are skipped.
// Demo portal login: CNIC 11111-1111111-1, password "demo-pass-123".
// All dummy CNICs start with 11111 or 99999 so they are easy to spot and remove later.
// Refuses to run in production.
import mongoose from "mongoose";
import { connectDB } from "@/server/db/mongoose";
import { getEnv } from "@/server/config/env";
import { Customer } from "@/server/models/Customer";
import { StaffUser } from "@/server/models/StaffUser";
import { createCustomer } from "@/server/services/customers";
import { setCustomerPortalPassword } from "@/server/services/customers/portal-access";

const DUMMY_CUSTOMERS = [
  { name: "Demo Customer", cnic: "11111-1111111-1", phones: ["0300-0000000"], fatherOrHusbandName: "Demo Father", profession: "Shopkeeper", homeAddress: "Demo Street, Rahim Yar Khan" },
  { name: "Ali Raza", cnic: "99999-0000001-1", phones: ["0301-1000001"], fatherOrHusbandName: "Muhammad Raza", profession: "Driver", homeAddress: "Model Town, Rahim Yar Khan", collectionAddress: "Shop 4, Shahi Road" },
  { name: "Ahmed Hassan", cnic: "99999-0000002-3", phones: ["0302-1000002", "0333-1000002"], fatherOrHusbandName: "Hassan Ali", profession: "Teacher", designation: "Senior teacher", homeAddress: "Abbasia Town, Rahim Yar Khan", businessAddress: "Govt. High School No. 2" },
  { name: "Bilal Ahmed", cnic: "99999-0000003-5", phones: ["0303-1000003"], fatherOrHusbandName: "Ahmed Din", profession: "Farmer", homeAddress: "Chak 85/P, Rahim Yar Khan" },
  { name: "Usman Tariq", cnic: "99999-0000004-7", phones: ["0304-1000004"], fatherOrHusbandName: "Tariq Mehmood", profession: "Electrician", homeAddress: "Satellite Town, Rahim Yar Khan" },
  { name: "Imran Khan", cnic: "99999-0000005-9", phones: ["0305-1000005"], fatherOrHusbandName: "Sher Khan", caste: "Pathan", profession: "Mechanic", homeAddress: "Auto Market, Rahim Yar Khan", collectionAddress: "Workshop 12, Auto Market" },
  { name: "Shazia Bibi", cnic: "99999-0000006-2", phones: ["0306-1000006"], fatherOrHusbandName: "Muhammad Aslam (husband)", profession: "Tailor", homeAddress: "Gulshan Iqbal, Rahim Yar Khan" },
  { name: "Kashif Mehmood", cnic: "99999-0000007-4", phones: ["0307-1000007"], fatherOrHusbandName: "Mehmood Ahmad", profession: "Government employee", designation: "Clerk", homeAddress: "City Park Road, Rahim Yar Khan", businessAddress: "District Courts" },
  { name: "Naveed Akhtar", cnic: "99999-0000008-6", phones: ["0308-1000008"], fatherOrHusbandName: "Akhtar Hussain", profession: "Shopkeeper", homeAddress: "Ghalla Mandi, Rahim Yar Khan" },
  { name: "Zeeshan Ali", cnic: "99999-0000009-8", phones: ["0309-1000009"], fatherOrHusbandName: "Liaqat Ali", profession: "Student", homeAddress: "Shadman Colony, Rahim Yar Khan" },
  { name: "Muhammad Asif", cnic: "99999-0000010-1", phones: ["0310-1000010"], fatherOrHusbandName: "Muhammad Yousaf", profession: "Labourer", homeAddress: "Basti Fauja, Rahim Yar Khan" },
  { name: "Ali Hamza", cnic: "99999-0000011-3", phones: ["0311-1000011"], fatherOrHusbandName: "Hamza Rafiq", profession: "Rickshaw driver", homeAddress: "Railway Colony, Rahim Yar Khan" },
];

async function main() {
  if (getEnv().NODE_ENV === "production") throw new Error("seed:dev must not run in production.");
  await connectDB();

  const superadmin = await StaffUser.findOne({ role: "superadmin" }).lean();
  if (!superadmin) throw new Error("Run `npm run create-superadmin` first.");
  const actor = { kind: "staff", id: String(superadmin._id), role: "superadmin", isActive: true };

  let added = 0;
  for (const c of DUMMY_CUSTOMERS) {
    const exists = await Customer.exists({ cnicNormalized: c.cnic.replace(/\D/g, "") });
    if (exists) continue;
    await createCustomer(actor, c);
    added += 1;
  }
  console.log(`Dummy customers: ${added} added, ${DUMMY_CUSTOMERS.length - added} already there.`);

  const demo = await Customer.findOne({ cnicNormalized: "1111111111111" }).select("_id").lean();
  await setCustomerPortalPassword(actor, String(demo._id), { password: "demo-pass-123" });
  console.log('Demo portal login: CNIC 11111-1111111-1, password "demo-pass-123".');
}

main()
  .catch((err) => {
    console.error(`Seed failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
