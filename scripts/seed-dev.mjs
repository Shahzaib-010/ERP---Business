// Development only: adds dummy customers and installment plans so the screens can be tried
// before the paper records are entered (D-006 answer 3). One customer has a portal login.
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
import { InstallmentPlan } from "@/server/models/InstallmentPlan";
import { applyDiscount, createPlan, recordPayment } from "@/server/services/installments";
import { Bike } from "@/server/models/Bike";
import { createBikePurchase, sellBikeForCash } from "@/server/services/bikes";

// Dummy bikes: some in stock, one still owed to the seller, one sold for cash, one sold on
// installments. Engine numbers start with "DEMO" so they are easy to spot and remove later.
const DUMMY_BIKES = [
  { make: "Honda", model: "CD70", modelYear: "2026", color: "Red", condition: "new", engineNumber: "DEMO-E1001", chassisNumber: "DEMO-C1001", sellerName: "Atlas Autos (dealer)", sellerPhone: "0300-5550001", purchaseDate: "2026-10-02", purchasePrice: "152000", paidNow: "152000" },
  { make: "Honda", model: "CD70", modelYear: "2026", color: "Black", condition: "new", engineNumber: "DEMO-E1002", chassisNumber: "DEMO-C1002", sellerName: "Atlas Autos (dealer)", sellerPhone: "0300-5550001", purchaseDate: "2026-10-02", purchasePrice: "152000", paidNow: "100000" },
  { make: "Yamaha", model: "YB125Z", modelYear: "2025", color: "Blue", condition: "used", registrationNumber: "RYK-2245", engineNumber: "DEMO-E2001", sellerName: "Imran Saeed", sellerPhone: "0301-5550002", purchaseDate: "2026-10-20", purchasePrice: "210000", paidNow: "150000" },
  { make: "Suzuki", model: "GD110S", modelYear: "2024", color: "Grey", condition: "used", registrationNumber: "RYK-1180", engineNumber: "DEMO-E3001", sellerName: "Tariq Motors", purchaseDate: "2026-09-15", purchasePrice: "165000", paidNow: "165000", sell: { customerCnic: "99999-0000004-7", saleDate: "2026-10-05", salePrice: "182000" } },
  { make: "Honda", model: "CG125", modelYear: "2026", color: "Red", condition: "new", engineNumber: "DEMO-E4001", sellerName: "Atlas Autos (dealer)", purchaseDate: "2026-10-25", purchasePrice: "235000", paidNow: "235000", installment: { customerCnic: "99999-0000005-9", agreementDate: "2026-11-01", cashPrice: "255000", agreedTotal: "320000", advanceAmount: "80000", installmentAmount: "20000", dueDayOfMonth: "5", firstDueDate: "2026-12-05" } },
  { make: "United", model: "US70", modelYear: "2026", color: "Black", condition: "new", engineNumber: "DEMO-E5001", sellerName: "United Dealer RYK", purchaseDate: "2026-11-03", purchasePrice: "118000", paidNow: "60000" },
];

// Dummy plans modelled on the two paper cards (amounts and schedules), with made-up people.
const DUMMY_PLANS = [
  {
    customerCnic: "11111-1111111-1",
    plan: {
      accountNumber: "1315",
      agreementDate: "2026-09-01",
      itemKind: "bike",
      itemDescription: "CD70 Dream, red, new",
      itemModel: "2026",
      itemSerial: "BJJ-4802",
      cashPrice: "155000",
      agreedTotal: "200000",
      advanceAmount: "70000",
      advanceReceiptNumber: "2432",
      schedule: { frequency: "monthly", dueDayOfMonth: "10", installmentAmount: "11000", firstDueDate: "2026-10-10" },
      guarantors: [{ name: "Demo Guarantor", fatherName: "Demo Father", phone: "0300-1112223", profession: "Shopkeeper" }],
    },
    payments: [{ amount: "11000", paidAt: "2026-10-09", receiptNumber: "2440" }],
  },
  {
    customerCnic: "99999-0000002-3",
    plan: {
      accountNumber: "1231",
      agreementDate: "2025-06-30",
      itemKind: "bike",
      itemDescription: "125, black, used",
      itemModel: "2025",
      cashPrice: "228000",
      agreedTotal: "297000",
      advanceAmount: "100000",
      schedule: { frequency: "monthly", dueDayOfMonth: "1", installmentAmount: "16000", firstDueDate: "2025-08-01" },
      notes: "Due on the 1st, from August.",
    },
    payments: ["2025-08-02", "2025-09-02", "2025-10-01", "2025-10-29", "2025-12-01", "2026-01-04", "2026-02-01", "2026-03-02", "2026-04-04", "2026-04-29", "2026-05-31"]
      .map((d) => ({ amount: "16000", paidAt: d }))
      .concat([{ amount: "20000", paidAt: "2026-06-29" }]),
    discount: { reason: "Last 1,000 waived (as on the paper card).", paidAt: "2026-06-29" },
  },
  {
    customerCnic: "99999-0000001-1",
    plan: {
      agreementDate: "2026-06-15",
      itemKind: "mobile",
      itemDescription: "Smartphone, 128 GB",
      agreedTotal: "60000",
      advanceAmount: "10000",
      schedule: { frequency: "monthly", dueDayOfMonth: "5", installmentAmount: "5000", firstDueDate: "2026-07-05" },
    },
    payments: [
      { amount: "5000", paidAt: "2026-07-04" },
      { amount: "5000", paidAt: "2026-08-06" },
      { amount: "3000", paidAt: "2026-09-10" },
    ],
  },
  {
    customerCnic: "99999-0000003-5",
    plan: {
      agreementDate: "2026-09-24",
      itemKind: "appliance",
      itemDescription: "Refrigerator, 14 cu ft",
      agreedTotal: "45000",
      advanceAmount: "0",
      schedule: { frequency: "weekly", installmentAmount: "3000", firstDueDate: "2026-10-01" },
    },
    payments: ["2026-10-01", "2026-10-08", "2026-10-15", "2026-10-22", "2026-10-29", "2026-11-05"].map((d) => ({ amount: "3000", paidAt: d })),
  },
];

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

  let plansAdded = 0;
  for (const d of DUMMY_PLANS) {
    const customer = await Customer.findOne({ cnicNormalized: d.customerCnic.replace(/\D/g, "") }).select("_id").lean();
    if (!customer) continue;
    if (d.plan.accountNumber && (await InstallmentPlan.exists({ accountNumber: Number(d.plan.accountNumber) }))) continue;
    if (!d.plan.accountNumber && (await InstallmentPlan.exists({ customerId: customer._id, "item.description": d.plan.itemDescription }))) continue;
    const { id } = await createPlan(actor, { ...d.plan, customerId: String(customer._id) });
    for (const pay of d.payments ?? []) await recordPayment(actor, id, pay);
    if (d.discount) await applyDiscount(actor, id, d.discount);
    plansAdded += 1;
  }
  console.log(`Dummy plans: ${plansAdded} added.`);

  let bikesAdded = 0;
  for (const { sell, installment, ...purchase } of DUMMY_BIKES) {
    const key = purchase.engineNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (await Bike.exists({ "keys.engine": key })) continue;
    const { id } = await createBikePurchase(actor, purchase);
    if (sell) {
      const c = await Customer.findOne({ cnicNormalized: sell.customerCnic.replace(/\D/g, "") }).select("_id").lean();
      if (c) await sellBikeForCash(actor, id, { customerId: String(c._id), saleDate: sell.saleDate, salePrice: sell.salePrice });
    }
    if (installment) {
      const c = await Customer.findOne({ cnicNormalized: installment.customerCnic.replace(/\D/g, "") }).select("_id").lean();
      if (c) {
        await createPlan(actor, {
          customerId: String(c._id),
          relatedBikeId: id,
          agreementDate: installment.agreementDate,
          itemKind: "bike",
          itemDescription: `${purchase.make} ${purchase.model}, ${purchase.color}, ${purchase.condition}`,
          itemModel: purchase.modelYear,
          itemSerial: purchase.engineNumber,
          cashPrice: installment.cashPrice,
          agreedTotal: installment.agreedTotal,
          advanceAmount: installment.advanceAmount,
          schedule: { frequency: "monthly", dueDayOfMonth: installment.dueDayOfMonth, installmentAmount: installment.installmentAmount, firstDueDate: installment.firstDueDate },
        });
      }
    }
    bikesAdded += 1;
  }
  console.log(`Dummy bikes: ${bikesAdded} added.`);

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
