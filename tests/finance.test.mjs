// Phase 5 acceptance tests: cash book and business figures, reconciled by hand (doc 04 §5).
// Each scenario runs on a fresh database so the expected totals are exact.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { startTestDb } from "./helpers.mjs";
import * as bd from "@/lib/business-date";

let db;
let m;
const staff = (role, permissions = []) => ({ kind: "staff", id: new mongoose.Types.ObjectId().toHexString(), role, permissions, isActive: true });
const owner = staff("superadmin");
const admin = staff("admin");
const today = bd.todayPk();
// A day inside the current month (business dates): the 1st, or today if it is the 1st.
const thisMonth = (d) => `${today.slice(0, 7)}-${String(Math.min(d, Number(today.slice(8)))).padStart(2, "0")}`;

before(async () => {
  db = await startTestDb();
  m = {
    bikes: await import("@/server/services/bikes"),
    plans: await import("@/server/services/installments"),
    customers: await import("@/server/services/customers"),
    cash: await import("@/server/services/cashbook"),
    finance: await import("@/server/services/finance"),
    errors: await import("@/server/errors"),
  };
});
after(async () => db?.stop());

describe("cash book and figures reconcile", () => {
  let customerId;
  let planId;
  let expenseId;

  before(async () => {
    customerId = (await m.customers.createCustomer(owner, { name: "Figures Customer", cnic: "31303-7777777-7" })).id;
    // Buy a bike for 100,000, pay 60,000 now -> owe 40,000 (scenario 6).
    await m.bikes.createBikePurchase(owner, { make: "Honda", model: "CD70", condition: "new", engineNumber: "FIG-1", sellerName: "Dealer", purchaseDate: thisMonth(1), purchasePrice: "100000", paidNow: "60000" });
    // Buy and sell a second bike for cash: bought 90,000 (paid in full), sold 120,000.
    const second = await m.bikes.createBikePurchase(owner, { make: "Honda", model: "CD70", condition: "new", engineNumber: "FIG-2", sellerName: "Dealer", purchaseDate: thisMonth(1), purchasePrice: "90000", paidNow: "90000" });
    await m.bikes.sellBikeForCash(owner, second.id, { customerId, saleDate: thisMonth(1), salePrice: "120000" });
    // Third bike sold on installments: 200,000 with 50,000 down, then 25,000 (scenarios 4–5).
    const third = await m.bikes.createBikePurchase(owner, { make: "Honda", model: "CG125", condition: "new", engineNumber: "FIG-3", sellerName: "Dealer", purchaseDate: thisMonth(1), purchasePrice: "150000", paidNow: "150000" });
    const plan = await m.plans.createPlan(owner, {
      customerId,
      relatedBikeId: third.id,
      agreementDate: thisMonth(1),
      itemKind: "bike",
      itemDescription: "CG125",
      agreedTotal: "200000",
      advanceAmount: "50000",
      schedule: { frequency: "monthly", dueDayOfMonth: "28", installmentAmount: "25000", firstDueDate: thisMonth(1) },
    });
    planId = plan.id;
    await m.plans.recordPayment(owner, planId, { amount: "25000", paidAt: thisMonth(1) });
    // Cash book entries.
    expenseId = (await m.cash.createTransaction(owner, { type: "expense", category: "rent", amount: "15,000", occurredAt: thisMonth(1), description: "Shop rent" })).id;
    await m.cash.createTransaction(owner, { type: "other_income", category: "commission", amount: "2000", occurredAt: thisMonth(1), description: "Commission" });
    await m.cash.createTransaction(owner, { type: "owner_investment", amount: "100000", occurredAt: thisMonth(1), description: "Capital" });
    await m.cash.createTransaction(owner, { type: "owner_withdrawal", amount: "10000", occurredAt: thisMonth(1), description: "Household" });
  });

  test("cash received = advance + installment + cash sale + other income + investment", async () => {
    const t = await m.cash.cashTotals({});
    assert.equal(t.cashIn, 50000 + 25000 + 120000 + 2000 + 100000);
  });

  test("cash paid = seller payments + expenses + withdrawals", async () => {
    const t = await m.cash.cashTotals({});
    assert.equal(t.cashOut, 60000 + 90000 + 150000 + 15000 + 10000);
    assert.equal(t.net, 297000 - 325000);
  });

  test("sales count each sale once, at sale time (200,000 plan + 120,000 cash)", async () => {
    const o = await m.finance.getFinanceOverview(owner, "month");
    assert.equal(o.kpis.sales.value, 320000);
    assert.equal(o.kpis.sales.installment, 200000);
    assert.equal(o.kpis.sales.cash, 120000);
  });

  test("receivables = plan balance; payables = owed to sellers", async () => {
    const o = await m.finance.getFinanceOverview(owner, "month");
    assert.equal(o.position.receivables, 125000);
    assert.equal(o.position.payables, 40000);
    assert.equal(o.position.stockCount, 1);
    assert.equal(o.position.stockValue, 100000);
  });

  test("a settlement discount is not cash", async () => {
    const before = await m.cash.cashTotals({});
    await m.plans.recordPayment(owner, planId, { amount: "124000", paidAt: thisMonth(1) });
    await m.plans.applyDiscount(owner, planId, { reason: "Last 1,000 waived", paidAt: thisMonth(1) });
    const after = await m.cash.cashTotals({});
    assert.equal(after.cashIn - before.cashIn, 124000, "only the cash payment counts");
    const o = await m.finance.getFinanceOverview(owner, "month");
    assert.equal(o.position.receivables, 0);
    assert.equal(o.kpis.sales.value, 320000, "sales unchanged by payments or discount");
  });

  test("the ledger lists every movement once, and voiding an expense removes it", async () => {
    const entries = await m.cash.collectEntries({});
    const ids = entries.map((e) => e.id);
    assert.equal(new Set(ids).size, ids.length, "no duplicates");
    const sumIn = entries.filter((e) => e.direction === "in").reduce((s, e) => s + e.amount, 0);
    const totals = await m.cash.cashTotals({});
    assert.equal(sumIn, totals.cashIn, "ledger and totals agree");

    await assert.rejects(m.cash.voidTransaction(staff("user", ["transactions.view"]), expenseId, { reason: "typo" }), m.errors.ForbiddenError);
    await m.cash.voidTransaction(admin, expenseId, { reason: "Entered twice" });
    const after = await m.cash.cashTotals({});
    assert.equal(totals.cashOut - after.cashOut, 15000);
    const stillListed = (await m.cash.collectEntries({})).some((e) => e.transactionId === expenseId);
    assert.equal(stillListed, false);
  });

  test("monthly trend has 12 months and this month's figures", async () => {
    const o = await m.finance.getFinanceOverview(owner, "12m");
    assert.equal(o.trend.length, 12);
    const now = o.trend.at(-1);
    const totals = await m.cash.cashTotals({});
    assert.equal(now.cashIn, totals.cashIn);
    assert.equal(now.cashOut, totals.cashOut);
    assert.equal(now.salesInstallment, 200000);
    assert.equal(now.salesCash, 120000);
  });

  test("validation and permissions", async () => {
    const e = await m.cash.createTransaction(owner, { type: "expense", amount: "0", occurredAt: "2999-01-01", description: "" }).catch((x) => x);
    assert.ok(e.fieldErrors.amount && e.fieldErrors.occurredAt && e.fieldErrors.description);
    const e2 = await m.cash.createTransaction(owner, { type: "expense", amount: "100", occurredAt: today, description: "Tea" }).catch((x) => x);
    assert.ok(e2.fieldErrors.category, "expenses need a category");
    await assert.rejects(m.cash.listCashbook(staff("user", []), {}), m.errors.ForbiddenError);
    await assert.rejects(m.finance.getFinanceOverview(staff("user", ["customers.view"]), "month"), m.errors.ForbiddenError);
  });

  test("period ranges: month, 3 months, 12 months, this year", () => {
    const r = m.cash.periodRange("3m", "2026-11-11");
    assert.equal(bd.dateOnlyString(r.from), "2026-09-01");
    assert.equal(bd.dateOnlyString(r.to), "2026-12-01");
    assert.equal(bd.dateOnlyString(r.prevFrom), "2026-06-01");
    const y = m.cash.periodRange("year", "2026-11-11");
    assert.equal(bd.dateOnlyString(y.from), "2026-01-01");
    assert.equal(bd.dateOnlyString(y.prevFrom), "2025-01-01");
  });
});
