// Development only: one realistic year of business (Dec of last year to today) so the
// dashboards, cash book, profit, reports and plan screens can be tested with real-looking data.
//
//   npm run seed:year
//
// Everything is written through the normal services (numbering, audit log, totals), in date
// order. Receipt numbers follow the date order. The data is random but repeatable (fixed seed).
//
// What it creates:
//   - Starting capital, and more owner capital whenever cash would run low before a purchase.
//   - 4–7 bikes bought per month (more before Eid), some paid to the seller in parts later.
//   - Most bikes sold within weeks: for cash (small margin) or on installments (bigger markup).
//   - 3–6 mobiles / appliances / other items per month on installments, with "Cost to us" and
//     the cost paid from business cash (D-019).
//   - Customers who pay on time, late, irregularly, early, or stop paying; a few settled with a
//     small discount.
//   - Monthly running costs (rent, salaries, seasonal electricity, fuel, tea, repairs, marketing,
//     quarterly taxes), other income (file fees, commission, service) and owner drawings.
//
// Markers so the dummy data is easy to find later: customer CNICs start with 77777, engine
// numbers with "YR-", voucher numbers with "YR-". Refuses to run twice or in production.
import mongoose from "mongoose";
import { connectDB } from "@/server/db/mongoose";
import { getEnv } from "@/server/config/env";
import { Customer } from "@/server/models/Customer";
import { StaffUser } from "@/server/models/StaffUser";
import { createCustomer } from "@/server/services/customers";
import { applyDiscount, createPlan, getNextNumbers, recordPayment } from "@/server/services/installments";
import { createBikePurchase, recordSellerPayment, sellBikeForCash } from "@/server/services/bikes";
import { createTransaction } from "@/server/services/cashbook";
import { todayPk } from "@/lib/business-date";

// ---------- helpers ----------

let seed = 20261113;
function rand() {
  // mulberry32: small, repeatable PRNG
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const int = (lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = (list) => list[Math.floor(rand() * list.length)];
const chance = (p) => rand() < p;
const roundTo = (n, step) => Math.round(n / step) * step;
const ceilTo = (n, step) => Math.ceil(n / step) * step;

const TODAY = todayPk();
const toDate = (s) => new Date(`${s}T00:00:00Z`);
const toStr = (d) => d.toISOString().slice(0, 10);
const addDays = (s, n) => toStr(new Date(toDate(s).getTime() + n * 86400e3));
const daysInMonth = (y, m) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
function monthDate(y, m, day) {
  const yy = y + Math.floor(m / 12);
  const mm = ((m % 12) + 12) % 12;
  return toStr(new Date(Date.UTC(yy, mm, Math.min(day, daysInMonth(yy, mm)))));
}
const ym = (s) => s.slice(0, 7);
const notFuture = (s) => s <= TODAY;

// First month: December of last year (12 months up to and including this one).
const T = toDate(TODAY);
const START_Y = T.getUTCFullYear();
const START_M = T.getUTCMonth() - 11;
const MONTHS = Array.from({ length: 12 }, (_, i) => ({ y: START_Y, m: START_M + i }));
const firstDay = monthDate(START_Y, START_M, 1);

// ---------- reference data ----------

const BIKES = [
  { make: "Honda", model: "CD70", newPrice: [152000, 158000], usedPrice: [95000, 125000], w: 5 },
  { make: "Honda", model: "CD70 Dream", newPrice: [162000, 168000], usedPrice: [110000, 135000], w: 2 },
  { make: "Honda", model: "Pridor", newPrice: [198000, 205000], usedPrice: [130000, 160000], w: 1 },
  { make: "Honda", model: "CG125", newPrice: [232000, 240000], usedPrice: [150000, 195000], w: 3 },
  { make: "Yamaha", model: "YB125Z", newPrice: [300000, 312000], usedPrice: [205000, 250000], w: 1 },
  { make: "Suzuki", model: "GD110S", newPrice: [275000, 285000], usedPrice: [170000, 215000], w: 1 },
  { make: "United", model: "US70", newPrice: [112000, 120000], usedPrice: [65000, 85000], w: 3 },
  { make: "Road Prince", model: "RP70", newPrice: [108000, 115000], usedPrice: [60000, 80000], w: 2 },
  { make: "Super Power", model: "SP70", newPrice: [105000, 112000], usedPrice: [58000, 75000], w: 1 },
];
const BIKE_POOL = BIKES.flatMap((b) => Array(b.w).fill(b));
const COLOURS = ["Red", "Black", "Blue", "Silver", "Grey", "Red/Black"];
const DEALERS = [
  { name: "Atlas Autos (dealer)", phone: "0300-5550001" },
  { name: "United Dealer RYK", phone: "0301-5550003" },
  { name: "Road Prince Motors", phone: "0302-5550004" },
  { name: "Suzuki Sadiq Motors", phone: "0303-5550005" },
];
const PRIVATE_SELLERS = ["Imran Saeed", "Tariq Mehmood", "Waqas Ahmed", "Rashid Ali", "Nadeem Abbas", "Sajid Hussain", "Fahad Iqbal", "Kamran Riaz"];

const ITEMS = [
  { kind: "mobile", description: "Samsung Galaxy A15, 128 GB", cost: [41000, 45000] },
  { kind: "mobile", description: "Infinix Hot 40, 256 GB", cost: [33000, 37000] },
  { kind: "mobile", description: "Tecno Spark 20 Pro", cost: [36000, 40000] },
  { kind: "mobile", description: "Vivo Y36, 256 GB", cost: [52000, 57000] },
  { kind: "mobile", description: "Oppo A78, 256 GB", cost: [58000, 63000] },
  { kind: "mobile", description: "iPhone 13, 128 GB (used, PTA)", cost: [125000, 140000] },
  { kind: "appliance", description: "Haier refrigerator, 14 cu ft", cost: [92000, 99000] },
  { kind: "appliance", description: "Dawlance refrigerator, 12 cu ft", cost: [82000, 88000] },
  { kind: "appliance", description: "Gree inverter AC, 1.5 ton", cost: [140000, 152000] },
  { kind: "appliance", description: "Orient inverter AC, 1 ton", cost: [112000, 120000] },
  { kind: "appliance", description: "LED TV 43 inch (Ecostar)", cost: [66000, 72000] },
  { kind: "appliance", description: "Washing machine, twin tub (Super Asia)", cost: [33000, 38000] },
  { kind: "appliance", description: "Water dispenser (Orient)", cost: [26000, 30000] },
  { kind: "appliance", description: "Room air cooler (Boss)", cost: [24000, 28000], summer: true },
  { kind: "appliance", description: "Pedestal fan pair (GFC)", cost: [17000, 19000], summer: true },
  { kind: "other", description: "Solar panel kit, 2 kW", cost: [168000, 182000] },
  { kind: "other", description: "Laptop, Core i5 (used)", cost: [78000, 90000] },
  { kind: "other", description: "Sewing machine (Singer)", cost: [21000, 24000] },
  { kind: "other", description: "Gas heater (Nasgas)", cost: [16000, 19000], winter: true },
];

const MALE = ["Muhammad Ali", "Ahmed Raza", "Bilal Hussain", "Usman Ghani", "Hamza Iqbal", "Zain Abbas", "Faisal Mehmood", "Shahid Nawaz", "Asif Javed", "Naveed Anjum",
  "Kashif Rehman", "Adnan Saleem", "Rizwan Ashraf", "Sohail Akhtar", "Waseem Abbas", "Irfan Haider", "Junaid Aslam", "Tahir Mehmood", "Arslan Khalid", "Qasim Shah",
  "Sajjad Ahmed", "Mudassar Iqbal", "Nasir Hussain", "Imtiaz Ahmed", "Zubair Khan", "Shoaib Akram", "Ali Haider", "Mubashir Hassan", "Yasir Arafat", "Abdul Rehman",
  "Ghulam Murtaza", "Allah Ditta", "Muhammad Ramzan", "Khadim Hussain", "Jamshed Iqbal", "Awais Qarni", "Hafiz Naeem", "Umair Saeed", "Saqib Mehmood", "Danish Ali"];
const FEMALE = ["Shazia Parveen", "Nasreen Bibi", "Rubina Kausar", "Sadia Batool", "Farzana Akhtar", "Kiran Shahzadi", "Samina Yasmin", "Asma Bibi", "Nusrat Jahan", "Bushra Naz"];
const FATHERS = ["Muhammad Aslam", "Ghulam Rasool", "Abdul Ghafoor", "Muhammad Yousaf", "Allah Wasaya", "Noor Muhammad", "Abdul Sattar", "Muhammad Iqbal", "Bashir Ahmed",
  "Manzoor Hussain", "Rafiq Ahmed", "Khalid Mehmood", "Muhammad Saleem", "Haji Akbar", "Fazal Din", "Sher Muhammad"];
const PROFESSIONS = ["Shopkeeper", "Farmer", "Driver", "Teacher", "Mechanic", "Electrician", "Labourer", "Government employee", "Rickshaw driver", "Tailor",
  "Student", "Factory worker", "Salesman", "Security guard", "Plumber", "Carpenter", "Barber", "Nurse"];
const AREAS = ["Model Town", "Abbasia Town", "Satellite Town", "Shadman Colony", "Gulshan Iqbal", "Railway Colony", "City Park Road", "Ghalla Mandi", "Auto Market",
  "Basti Fauja", "Chak 85/P", "Chak 92/P", "Khanpur Road", "Sadiqabad Road", "Shahi Road", "Islamia Colony"];

// ---------- people ----------

let cnicCounter = 1;
const customers = []; // { key, input, id }
function newCustomer() {
  const female = chance(0.15);
  const n = cnicCounter++;
  const body = String(n).padStart(7, "0");
  const area = pick(AREAS);
  const c = {
    key: `c${n}`,
    id: null,
    input: {
      name: female ? pick(FEMALE) : pick(MALE),
      cnic: `77777-${body}-${female ? pick([2, 4, 6, 8]) : pick([1, 3, 5, 7, 9])}`,
      phones: [`03${int(0, 4)}${int(0, 9)}-${String(int(1000000, 9999999))}`],
      fatherOrHusbandName: `${pick(FATHERS)}${female ? " (husband)" : ""}`,
      profession: pick(PROFESSIONS),
      homeAddress: `${area}, Rahim Yar Khan`,
    },
  };
  customers.push(c);
  return c;
}
function customerFor() {
  // Some repeat customers come back for a second item.
  if (customers.length > 15 && chance(0.15)) return pick(customers);
  return newCustomer();
}

// ---------- event planning ----------

const events = []; // { date, prio, kind, ...data }
const PRIO = { investment: 0, purchase: 1, expense: 2, income: 2, sellerPayment: 2, cashSale: 3, plan: 3, payment: 4, discount: 5, withdrawal: 6 };
// Keep the same object (not a copy): later events read the id written onto it (bikeRef, planRef).
const add = (e) => {
  if (!notFuture(e.date)) return;
  e.prio = PRIO[e.kind];
  events.push(e);
};
let voucher = 1;
let bikeCounter = 0;
const v = () => `YR-${String(voucher++).padStart(4, "0")}`;

const isSummer = (m) => [4, 5, 6, 7, 8].includes(((m % 12) + 12) % 12); // May–Sep
const isWinter = (m) => [11, 0, 1].includes(((m % 12) + 12) % 12); // Dec–Feb
const isEidMonth = (m) => [2, 4].includes(((m % 12) + 12) % 12); // Mar (Eid ul Fitr), May (Eid ul Adha)

/** Customer payment behaviour for a plan; returns payment events. */
function planPayments(plan) {
  const out = [];
  const type = pick(["good", "good", "good", "good", "good", "good", "average", "average", "average", "poor", "poor", "stopper", "early"]);
  let remaining = plan.total - plan.advance;
  let skipped = 0;
  let k = 0;
  let stopAfter = type === "stopper" ? int(2, 5) : Infinity;
  for (let due = plan.firstDue; remaining > 0 && k < 80; k++) {
    const amount = plan.installment;
    let pay = amount;
    let date = due;
    if (type === "good") {
      date = addDays(due, int(-4, 3));
      if (chance(0.08)) pay = amount * 2;
    } else if (type === "early") {
      date = addDays(due, int(-6, 0));
      if (k >= 3 && chance(0.25)) pay = remaining; // pays off early in one go
    } else if (type === "average") {
      date = addDays(due, int(0, 12));
      if (chance(0.15)) {
        skipped += amount;
        pay = 0;
      } else if (skipped) {
        pay = amount + skipped;
        skipped = 0;
      }
    } else if (type === "poor") {
      date = addDays(due, int(3, 25));
      if (chance(0.3)) pay = 0;
      else pay = roundTo(amount * pick([0.5, 0.6, 1, 1, 1.5]), 500);
    }
    if (k >= stopAfter) break;
    if (pay > 0) {
      if (date < plan.date) date = plan.date;
      if (!notFuture(date)) break;
      pay = Math.min(pay, remaining);
      // A good customer's last payment: sometimes the last 500–1,000 is waived (D-008).
      if (type === "good" && pay === remaining && remaining > 2000 && chance(0.2)) {
        const waived = pick([500, 1000]);
        out.push({ kind: "payment", date, planRef: plan, amount: remaining - waived, receipt: true });
        out.push({ kind: "discount", date, planRef: plan, reason: `Last Rs ${waived.toLocaleString("en-PK")} waived at settlement.` });
        remaining = 0;
        break;
      }
      out.push({ kind: "payment", date, planRef: plan, amount: pay, receipt: true });
      remaining -= pay;
    }
    due = plan.frequency === "weekly" ? addDays(due, 7) : nextMonthly(due, plan.dueDay);
    if (!notFuture(due) && !notFuture(addDays(due, -6))) break;
  }
  return out;
}
function nextMonthly(s, dueDay) {
  const d = toDate(s);
  return monthDate(d.getUTCFullYear(), d.getUTCMonth() + 1, dueDay);
}

function planInstallmentSale({ date, total, cost, cashPrice, kind, description, model, serial, bikeRef, cheap }) {
  const advance = roundTo(total * (cheap ? int(10, 20) : int(20, 35)) / 100, 1000);
  const weekly = cheap && chance(0.5);
  const dueDay = pick([1, 5, 10, 10, 15, 20, 25]);
  const firstDue = weekly ? addDays(date, 7) : monthDate(toDate(date).getUTCFullYear(), toDate(date).getUTCMonth() + 1, dueDay);
  const count = weekly ? int(12, 24) : pick(bikeRef ? [10, 12, 12, 15, 18] : [4, 6, 6, 8, 10, 12]);
  const installment = ceilTo((total - advance) / count, weekly ? 100 : 500);
  const plan = {
    kind: "plan", date, customer: customerFor(), total, advance, cost, cashPrice: Math.min(cashPrice, total), itemKind: kind, description, model, serial, bikeRef,
    frequency: weekly ? "weekly" : "monthly", dueDay, firstDue, installment, id: null, receipt: advance > 0,
  };
  add(plan);
  for (const p of planPayments(plan)) add(p);
}

for (const { y, m } of MONTHS) {
  const mStart = monthDate(y, m, 1);
  if (!notFuture(mStart)) continue;
  const dim = daysInMonth(toDate(mStart).getUTCFullYear(), toDate(mStart).getUTCMonth());
  const day = (d) => monthDate(y, m, d);
  const monthIndex = MONTHS.findIndex((x) => x.y === y && x.m === m);

  // Bikes bought this month, and what happens to each.
  const bikesThisMonth = int(4, 6) + (isEidMonth(m) ? 2 : 0);
  for (let i = 0; i < bikesThisMonth; i++) {
    const model = pick(BIKE_POOL);
    const isNew = chance(0.6);
    const [lo, hi] = isNew ? model.newPrice : model.usedPrice;
    const price = roundTo(int(lo, hi), 500);
    const date = day(int(1, dim));
    const dealer = isNew || chance(0.3);
    const seller = dealer ? pick(DEALERS) : { name: pick(PRIVATE_SELLERS), phone: `030${int(0, 9)}-${int(1000000, 9999999)}` };
    const fullyPaid = chance(dealer ? 0.7 : 0.85);
    const paidNow = fullyPaid ? price : roundTo(price * int(55, 80) / 100, 5000);
    const n = ++bikeCounter;
    const engine = `YR-E${String(n).padStart(5, "0")}`;
    const colour = pick(COLOURS);
    const year = toDate(mStart).getUTCFullYear();
    const modelYear = String(isNew ? year : int(year - 6, year - 1));
    const bike = {
      kind: "purchase", date, price, paidNow, id: null,
      input: {
        make: model.make, model: model.model, modelYear, color: colour, condition: isNew ? "new" : "used",
        engineNumber: engine, chassisNumber: `YR-C${engine.slice(4)}`,
        ...(isNew ? {} : { registrationNumber: `RYK-${6000 + n}` }),
        sellerName: seller.name, sellerPhone: seller.phone, purchaseDate: date,
        purchasePrice: String(price), paidNow: String(paidNow),
      },
    };
    add(bike);
    // Rest paid to the seller in one or two parts, 2–6 weeks later.
    if (!fullyPaid) {
      let owed = price - paidNow;
      const parts = owed > 40000 && chance(0.5) ? 2 : 1;
      let d = date;
      for (let p = 0; p < parts && owed > 0; p++) {
        d = addDays(d, int(14, 40));
        const amount = p === parts - 1 ? owed : roundTo(owed / 2, 5000);
        add({ kind: "sellerPayment", date: d, bikeRef: bike, amount });
        owed -= amount;
      }
    }
    // Sold within 4–50 days: cash or installments; some stay in stock.
    const saleDate = addDays(date, int(4, 50));
    const fate = rand();
    if (fate < 0.5) {
      const margin = isNew ? int(10, 20) * 1000 : int(15, 35) * 1000;
      add({ kind: "cashSale", date: saleDate, bikeRef: bike, customer: customerFor(), price: price + margin, receipt: true });
      add({ kind: "income", date: saleDate, input: { type: "other_income", category: "documents", amount: String(pick([1500, 2000, 2500, 3000])), description: `Transfer / file fee, ${model.make} ${model.model}`, voucherNumber: v() } });
    } else if (fate < 0.92) {
      const total = roundTo(price * int(138, 150) / 100, 1000);
      planInstallmentSale({
        date: saleDate, total, cost: null, cashPrice: roundTo(price + int(10, 16) * 1000, 1000), kind: "bike",
        description: `${model.make} ${model.model}, ${colour.toLowerCase()}, ${isNew ? "new" : "used"}`, model: modelYear, serial: engine, bikeRef: bike,
      });
      add({ kind: "income", date: saleDate, input: { type: "other_income", category: "documents", amount: String(pick([2000, 2500, 3000])), description: `File charges, ${model.make} ${model.model} plan`, voucherNumber: v() } });
    }
  }

  // Mobiles, appliances and other items on installments.
  const itemsThisMonth = int(5, 8) + (isEidMonth(m) ? 2 : 0) + (isSummer(m) ? 2 : 0);
  const pool = ITEMS.filter((it) => (!it.summer || isSummer(m)) && (!it.winter || isWinter(m)));
  for (let i = 0; i < itemsThisMonth; i++) {
    const it = pick(pool);
    const cost = roundTo(int(it.cost[0], it.cost[1]), 500);
    const total = roundTo(cost * int(135, 155) / 100, 500);
    planInstallmentSale({
      date: day(int(1, dim)), total, cost, cashPrice: roundTo(cost * 1.08, 500), kind: it.kind, description: it.description,
      model: undefined, serial: it.kind === "mobile" ? `IMEI 35${int(1000000, 9999999)}${int(100000, 999999)}` : undefined, cheap: cost < 45000,
    });
  }

  // Running costs.
  const raise = monthIndex >= 7 ? 1.1 : 1; // salary raise from July
  const exp = (d, category, amount, description, party) =>
    add({ kind: "expense", date: day(d), input: { type: "expense", category, amount: String(amount), description, party, voucherNumber: v() } });
  exp(int(1, 5), "rent", 50000, "Shop rent", "Landlord (Haji Akbar)");
  exp(int(1, 3), "salaries", roundTo(35000 * raise, 500), "Salary: showroom manager", "Kamran (manager)");
  exp(int(1, 3), "salaries", roundTo(26000 * raise, 500), "Salary: recovery officer", "Shahid (recovery)");
  exp(int(1, 3), "salaries", roundTo(18000 * raise, 500), "Salary: helper", "Ali (helper)");
  exp(int(6, 10), "utilities", isSummer(m) ? roundTo(int(22000, 31000), 100) : roundTo(int(8500, 13000), 100), "Electricity bill (MEPCO)", "MEPCO");
  exp(int(10, 14), "utilities", 3200, "Mobile and internet package", "PTCL / Jazz");
  if (isWinter(m)) exp(int(10, 15), "utilities", int(2500, 4500), "Gas bill (SNGPL)", "SNGPL");
  for (let f = 0; f < int(2, 4); f++) exp(int(1, dim), "transport", roundTo(int(2500, 5000), 100), pick(["Petrol for recovery visits", "Bike delivery fuel", "Loader rent for stock"]));
  exp(int(14, 20), "office", roundTo(int(4000, 7000), 100), "Tea, water and office supplies");
  if (chance(0.6)) exp(int(1, dim), "repairs", roundTo(int(2500, 12000), 500), pick(["Workshop repair on used bike", "Showroom light and fan repair", "Tyre and battery change (stock bike)"]));
  if (chance(0.5)) exp(int(1, dim), "parts", roundTo(int(5000, 15000), 500), pick(["Helmets and side mirrors", "Seat covers and mudflaps", "Engine oil stock"]));
  if (chance(0.5)) exp(int(1, dim), "registration", roundTo(int(3000, 9000), 500), "Excise registration and transfer charges");
  if (isEidMonth(m) || chance(0.3)) exp(int(1, 10), "marketing", isEidMonth(m) ? 25000 : roundTo(int(8000, 15000), 500), isEidMonth(m) ? "Eid offer banners and Facebook ads" : "Banners and pamphlets");
  if ([2, 5, 8, 11].includes(((m % 12) + 12) % 12)) exp(int(15, 25), "taxes", 15000, "Quarterly professional tax and fees", "Excise & Taxation");

  // Other income and owner drawings.
  add({ kind: "income", date: day(int(18, 26)), input: { type: "other_income", category: "service", amount: String(roundTo(int(4000, 9000), 500)), description: "Tuning and service charges", voucherNumber: v() } });
  if (chance(0.5)) add({ kind: "income", date: day(int(1, dim)), input: { type: "other_income", category: "commission", amount: String(roundTo(int(5000, 15000), 1000)), description: "Commission on a bike sold for a third party", voucherNumber: v() } });
  add({ kind: "withdrawal", date: day(int(26, dim)), input: { type: "owner_withdrawal", amount: String(roundTo(int(60000, 80000), 5000)), description: "Owner household drawing", voucherNumber: v() } });
  if (isEidMonth(m)) add({ kind: "withdrawal", date: day(int(15, 20)), input: { type: "owner_withdrawal", amount: "60000", description: "Owner Eid expenses", voucherNumber: v() } });
}

add({ kind: "investment", date: firstDay, input: { type: "owner_investment", amount: "3500000", description: "Starting capital", voucherNumber: v() } });

events.sort((a, b) => a.date.localeCompare(b.date) || a.prio - b.prio);

// Cash check: add owner capital on the day cash would fall below Rs 300,000.
const cashIn = (e) =>
  e.kind === "investment" || e.kind === "income" ? Number(e.input.amount) : e.kind === "cashSale" ? e.price : e.kind === "plan" ? e.advance : e.kind === "payment" ? e.amount : 0;
const cashOut = (e) =>
  e.kind === "purchase" ? e.paidNow : e.kind === "sellerPayment" ? e.amount : e.kind === "plan" ? (e.cost ?? 0) : e.kind === "expense" || e.kind === "withdrawal" ? Number(e.input.amount) : 0;
const planned = [];
let cash = 0;
for (const e of events) {
  const out = cashOut(e);
  if (out && cash - out < 300000) {
    const top = { kind: "investment", date: e.date, prio: 0, input: { type: "owner_investment", amount: "1000000", description: "More capital for stock", voucherNumber: v() } };
    planned.push(top);
    cash += 1000000;
  }
  planned.push(e);
  cash += cashIn(e) - out;
}

// ---------- write ----------

async function main() {
  if (getEnv().NODE_ENV === "production") throw new Error("seed:year must not run in production.");
  await connectDB();
  const superadmin = await StaffUser.findOne({ role: "superadmin" }).lean();
  if (!superadmin) throw new Error("Run `npm run create-superadmin` first.");
  if (await Customer.exists({ cnicNormalized: /^77777/ })) throw new Error("The year of dummy data is already there (customers with CNIC 77777-…).");
  const actor = { kind: "staff", id: String(superadmin._id), role: "superadmin", isActive: true };

  let { receiptNumber } = await getNextNumbers(actor);
  const nextReceipt = () => String(receiptNumber++);
  const counts = {};
  const ensureCustomer = async (c) => {
    if (!c.id) c.id = (await createCustomer(actor, c.input)).id;
    return c.id;
  };

  console.log(`Writing ${planned.length} events from ${firstDay} to ${TODAY}…`);
  let i = 0;
  for (const e of planned) {
    i++;
    if (i % 100 === 0) console.log(`  ${i} / ${planned.length}`);
    try {
      if (e.kind === "investment" || e.kind === "expense" || e.kind === "income" || e.kind === "withdrawal") {
        await createTransaction(actor, { ...e.input, occurredAt: e.date });
      } else if (e.kind === "purchase") {
        e.id = (await createBikePurchase(actor, e.input)).id;
      } else if (e.kind === "sellerPayment") {
        await recordSellerPayment(actor, e.bikeRef.id, { amount: String(e.amount), paidAt: e.date });
      } else if (e.kind === "cashSale") {
        await sellBikeForCash(actor, e.bikeRef.id, { customerId: await ensureCustomer(e.customer), saleDate: e.date, salePrice: String(e.price), receiptNumber: nextReceipt() });
      } else if (e.kind === "plan") {
        const guarantor = e.bikeRef ? [{ name: pick(MALE), fatherName: pick(FATHERS), phone: `0300-${int(1000000, 9999999)}`, profession: pick(PROFESSIONS) }] : [];
        e.id = (
          await createPlan(actor, {
            customerId: await ensureCustomer(e.customer),
            relatedBikeId: e.bikeRef?.id,
            agreementDate: e.date,
            itemKind: e.itemKind,
            itemDescription: e.description,
            itemModel: e.model,
            itemSerial: e.serial,
            cashPrice: String(e.cashPrice),
            agreedTotal: String(e.total),
            advanceAmount: String(e.advance),
            advanceReceiptNumber: e.advance > 0 ? nextReceipt() : undefined,
            itemCost: e.cost ? String(e.cost) : undefined,
            itemCostPaidFromCash: e.cost ? "on" : undefined,
            schedule: {
              frequency: e.frequency,
              dueDayOfMonth: e.frequency === "monthly" ? String(e.dueDay) : undefined,
              installmentAmount: String(e.installment),
              firstDueDate: e.firstDue,
            },
            guarantors: guarantor,
          })
        ).id;
      } else if (e.kind === "payment") {
        if (!e.planRef.id) continue;
        await recordPayment(actor, e.planRef.id, { amount: String(e.amount), paidAt: e.date, receiptNumber: nextReceipt() });
      } else if (e.kind === "discount") {
        if (!e.planRef.id) continue;
        await applyDiscount(actor, e.planRef.id, { reason: e.reason, paidAt: e.date });
      }
      counts[e.kind] = (counts[e.kind] ?? 0) + 1;
    } catch (err) {
      const detail = err.fieldErrors ? ` ${JSON.stringify(err.fieldErrors)}` : "";
      console.warn(`  skipped ${e.kind} on ${e.date}: ${err.message}${detail}`);
    }
  }
  console.log("Done:", counts);
  console.log(`Customers created: ${customers.filter((c) => c.id).length}. Projected cash in hand from this data: Rs ${cash.toLocaleString("en-PK")}.`);
}

main()
  .catch((err) => {
    console.error(`Seed failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
