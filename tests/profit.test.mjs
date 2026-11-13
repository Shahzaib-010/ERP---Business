// D-019 profit: earned, not cash. Worked out by hand on a fresh database.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { startTestDb } from "./helpers.mjs";
import * as bd from "@/lib/business-date";

let db;
let m;
const staff = (role, permissions = []) => ({ kind: "staff", id: new mongoose.Types.ObjectId().toHexString(), role, permissions, isActive: true });
const owner = staff("superadmin");
const today = bd.todayPk();
const thisMonth = (d) => `${today.slice(0, 7)}-${String(Math.min(d, Number(today.slice(8)))).padStart(2, "0")}`;
const schedule = (amount) => ({ frequency: "monthly", dueDayOfMonth: "28", installmentAmount: amount, firstDueDate: thisMonth(1) });

before(async () => {
  db = await startTestDb();
  m = {
    bikes: await import("@/server/services/bikes"),
    plans: await import("@/server/services/installments"),
    customers: await import("@/server/services/customers"),
    cash: await import("@/server/services/cashbook"),
    finance: await import("@/server/services/finance"),
  };
});
after(async () => db?.stop());

describe("profit", () => {
  let customerId;
  let mobilePlanId;
  let appliancePlanId;
  let cashBefore;

  before(async () => {
    customerId = (await m.customers.createCustomer(owner, { name: "Profit Customer", cnic: "31303-8888888-8" })).id;
    // Cash bike sale: bought 90,000, sold 120,000 -> 30,000.
    const b1 = await m.bikes.createBikePurchase(owner, { make: "Honda", model: "CD70", condition: "new", engineNumber: "PR-1", sellerName: "Dealer", purchaseDate: thisMonth(1), purchasePrice: "90000", paidNow: "90000" });
    await m.bikes.sellBikeForCash(owner, b1.id, { customerId, saleDate: thisMonth(1), salePrice: "120000" });
    // Bike on installments: bought 150,000, plan 200,000 with 50,000 down -> 50,000.
    const b2 = await m.bikes.createBikePurchase(owner, { make: "Honda", model: "CG125", condition: "new", engineNumber: "PR-2", sellerName: "Dealer", purchaseDate: thisMonth(1), purchasePrice: "150000", paidNow: "150000" });
    await m.plans.createPlan(owner, {
      customerId, relatedBikeId: b2.id, agreementDate: thisMonth(1), itemKind: "bike", itemDescription: "CG125",
      agreedTotal: "200000", advanceAmount: "50000", itemCost: "999", schedule: schedule("25000"),
    });
    cashBefore = await m.cash.cashTotals({});
    // Mobile: cost 20,000 paid from business cash, sold for 25,000 with 5,000 down -> 5,000.
    mobilePlanId = (await m.plans.createPlan(owner, {
      customerId, agreementDate: thisMonth(1), itemKind: "mobile", itemDescription: "Phone",
      agreedTotal: "25000", advanceAmount: "5000", itemCost: "20,000", itemCostPaidFromCash: "on", schedule: schedule("5000"),
    })).id;
    // Appliance with no cost entered yet: left out of profit.
    appliancePlanId = (await m.plans.createPlan(owner, {
      customerId, agreementDate: thisMonth(1), itemKind: "appliance", itemDescription: "Fridge",
      agreedTotal: "30000", schedule: schedule("5000"),
    })).id;
    await m.cash.createTransaction(owner, { type: "expense", category: "rent", amount: "15000", occurredAt: thisMonth(1), description: "Rent" });
    await m.cash.createTransaction(owner, { type: "other_income", category: "commission", amount: "2000", occurredAt: thisMonth(1), description: "Commission" });
    await m.cash.createTransaction(owner, { type: "owner_investment", amount: "100000", occurredAt: thisMonth(1), description: "Capital" });
    await m.cash.createTransaction(owner, { type: "owner_withdrawal", amount: "10000", occurredAt: thisMonth(1), description: "Household" });
  });

  test("gross and net profit; owner money is not profit", async () => {
    const { profit } = await m.finance.getFinanceOverview(owner, "month");
    assert.equal(profit.sales, 120000 + 200000 + 25000);
    assert.equal(profit.cost, 90000 + 150000 + 20000, "bike plan uses the bike's price, not the typed cost");
    assert.equal(profit.gross, 30000 + 50000 + 5000);
    assert.equal(profit.otherIncome, 2000);
    assert.equal(profit.expenses, 15000);
    assert.equal(profit.net, 85000 + 2000 - 15000);
    assert.equal(profit.missingCount, 1);
    assert.equal(profit.missingSales, 30000);
  });

  test("profit still inside customer balances", async () => {
    const { profit } = await m.finance.getFinanceOverview(owner, "month");
    // bike plan 50,000 × 150,000 ÷ 200,000 + mobile 5,000 × 20,000 ÷ 25,000
    assert.equal(profit.uncollected, 37500 + 4000);
  });

  test("paid from business cash: one cash-out row linked to the plan, not an expense", async () => {
    const t = await m.cash.cashTotals({});
    assert.equal(t.parts.itemPurchases, 20000);
    assert.equal(t.parts.expenses, 15000);
    const entry = (await m.cash.collectEntries({})).find((e) => e.source === "item_purchase");
    assert.equal(entry.amount, 20000);
    assert.equal(entry.href, `/plans/${mobilePlanId}`);
    const plan = await m.plans.getPlan(owner, mobilePlanId);
    assert.equal(plan.profit.cost, 20000);
    assert.equal(plan.profit.profit, 5000);
    assert.equal(plan.profit.paidFromCash.amount, 20000);
    assert.ok(cashBefore, "set up");
  });

  test("ticking paid-from-cash needs a cost", async () => {
    const e = await m.plans
      .createPlan(owner, { customerId, agreementDate: thisMonth(1), itemKind: "other", itemDescription: "Thing", agreedTotal: "1000", advanceAmount: "1000", itemCostPaidFromCash: "on", schedule: schedule("") })
      .catch((x) => x);
    assert.ok(e.fieldErrors?.itemCost);
  });

  test("adding the cost later includes the plan, and the cash-out is recorded once", async () => {
    const details = { itemKind: "appliance", itemDescription: "Fridge", itemCost: "24000", itemCostPaidFromCash: "on" };
    await m.plans.updatePlanDetails(owner, appliancePlanId, details);
    await m.plans.updatePlanDetails(owner, appliancePlanId, details);
    const t = await m.cash.cashTotals({});
    assert.equal(t.parts.itemPurchases, 20000 + 24000);
    const { profit } = await m.finance.getFinanceOverview(owner, "month");
    assert.equal(profit.missingCount, 0);
    assert.equal(profit.gross, 85000 + 6000);
  });

  test("a settlement discount lowers profit", async () => {
    await m.plans.recordPayment(owner, mobilePlanId, { amount: "19000", paidAt: thisMonth(1) });
    await m.plans.applyDiscount(owner, mobilePlanId, { reason: "Last 1,000 waived", paidAt: thisMonth(1) });
    const { profit, trend } = await m.finance.getFinanceOverview(owner, "month");
    assert.equal(profit.discounts, 1000);
    assert.equal(profit.gross, 91000 - 1000);
    assert.equal(trend.at(-1).grossProfit, profit.gross);
    assert.equal(trend.at(-1).netProfit, profit.net);
    const plan = await m.plans.getPlan(owner, mobilePlanId);
    assert.equal(plan.profit.profit, 4000);
  });
});
