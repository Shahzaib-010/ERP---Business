// Phase 3 acceptance tests: bike register, seller payables and sales (doc 04 scenarios 4–7).
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { startTestDb } from "./helpers.mjs";
import * as bd from "@/lib/business-date";

let db;
let m;

const staff = (role, permissions = []) => ({
  kind: "staff",
  id: new mongoose.Types.ObjectId().toHexString(),
  role,
  permissions,
  isActive: true,
});
const owner = staff("superadmin");
const admin = staff("admin");
const clerk = staff("user", ["bikes.view", "bikes.create", "installments.view", "installments.create", "payments.create", "customers.view"]);
const viewer = staff("user", ["bikes.view"]);

const day = (n) => bd.dateOnlyString(bd.addDays(bd.parseDateOnly(bd.todayPk()), n));

before(async () => {
  db = await startTestDb();
  m = {
    bikes: await import("@/server/services/bikes"),
    plans: await import("@/server/services/installments"),
    customers: await import("@/server/services/customers"),
    errors: await import("@/server/errors"),
    Bike: (await import("@/server/models/Bike")).Bike,
  };
});
after(async () => db?.stop());

const purchase = (over = {}) => ({
  make: "Honda",
  model: "CD70",
  modelYear: "2026",
  color: "Red",
  condition: "new",
  sellerName: "Atlas Dealer",
  purchaseDate: day(-30),
  purchasePrice: "100,000",
  paidNow: "60000",
  ...over,
});

describe("bike purchases and seller payables", () => {
  test("scenario 6: buy for 100,000, pay 60,000 -> 40,000 owed to the seller", async () => {
    const { id, bikeNumber } = await m.bikes.createBikePurchase(clerk, purchase({ engineNumber: "eng 001" }));
    assert.equal(bikeNumber, 1);
    const bike = await m.bikes.getBike(viewer, id);
    assert.equal(bike.purchase.paid, 60000);
    assert.equal(bike.purchase.payable, 40000);
    assert.equal(bike.status, "in_stock");
    assert.equal(bike.engineNumber, "ENG 001");
  });

  test("scenario 7: pay the remaining 40,000 -> nothing owed; overpaying is refused", async () => {
    const { id } = await m.bikes.createBikePurchase(clerk, purchase({ engineNumber: "ENG-002" }));
    const over = await m.bikes.recordSellerPayment(clerk, id, { amount: "40001", paidAt: day(-1) }).catch((e) => e);
    assert.ok(over instanceof m.errors.ValidationError);
    await m.bikes.recordSellerPayment(clerk, id, { amount: "40000", paidAt: day(-1) });
    const bike = await m.bikes.getBike(viewer, id);
    assert.equal(bike.purchase.payable, 0);
    assert.deepEqual(bike.sellerPayments.map((p) => p.owedAfter), [40000, 0]);
  });

  test("voiding a seller payment keeps it and restores the amount owed", async () => {
    const { id } = await m.bikes.createBikePurchase(clerk, purchase({ engineNumber: "ENG-003" }));
    const bike = await m.bikes.getBike(viewer, id);
    await assert.rejects(m.bikes.voidSellerPayment(clerk, bike.sellerPayments[0].id, { reason: "typo" }), m.errors.ForbiddenError);
    await m.bikes.voidSellerPayment(admin, bike.sellerPayments[0].id, { reason: "Entered twice" });
    const after = await m.bikes.getBike(viewer, id);
    assert.equal(after.purchase.payable, 100000);
    assert.equal(after.sellerPayments[0].status, "voided");
  });

  test("registration, engine and chassis numbers are unique, whatever the spacing", async () => {
    await m.bikes.createBikePurchase(clerk, purchase({ registrationNumber: "BJJ-4802", engineNumber: "E-100", chassisNumber: "C-100" }));
    const e1 = await m.bikes.createBikePurchase(clerk, purchase({ registrationNumber: "bjj 4802" })).catch((e) => e);
    assert.ok(e1 instanceof m.errors.ConflictError && e1.fieldErrors.registrationNumber);
    const e2 = await m.bikes.createBikePurchase(clerk, purchase({ engineNumber: "e100" })).catch((e) => e);
    assert.ok(e2.fieldErrors.engineNumber);
    const e3 = await m.bikes.createBikePurchase(clerk, purchase({ chassisNumber: "C 100" })).catch((e) => e);
    assert.ok(e3.fieldErrors.chassisNumber);
  });

  test("validation: paid now above price, future date, missing seller", async () => {
    const e = await m.bikes.createBikePurchase(clerk, purchase({ purchaseDate: day(2), sellerName: "" })).catch((x) => x);
    assert.ok(e.fieldErrors.purchaseDate);
    assert.ok(e.fieldErrors.sellerName);
    // Cross-field checks run once the individual fields are valid.
    const e2 = await m.bikes.createBikePurchase(clerk, purchase({ paidNow: "150000" })).catch((x) => x);
    assert.ok(e2.fieldErrors.paidNow);
  });
});

describe("bike sales", () => {
  let customerId;
  before(async () => {
    customerId = (await m.customers.createCustomer(owner, { name: "Sale Customer", cnic: "31303-5555555-5" })).id;
  });

  test("cash sale marks the bike sold to the customer; it cannot be sold twice", async () => {
    const { id } = await m.bikes.createBikePurchase(clerk, purchase({ engineNumber: "CASH-1", paidNow: "100000" }));
    await m.bikes.sellBikeForCash(clerk, id, { customerId, saleDate: day(0), salePrice: "125000", receiptNumber: "7001" });
    const bike = await m.bikes.getBike(viewer, id);
    assert.equal(bike.status, "sold");
    assert.equal(bike.saleDetail.mode, "cash");
    assert.equal(bike.saleDetail.price, 125000);
    assert.equal(bike.saleDetail.customer.name, "Sale Customer");
    await assert.rejects(m.bikes.sellBikeForCash(clerk, id, { customerId, saleDate: day(0), salePrice: "1" }), m.errors.ValidationError);
  });

  test("a receipt number used on a cash sale cannot be reused on a plan payment", async () => {
    const plan = await m.plans.createPlan(clerk, {
      customerId,
      agreementDate: day(-10),
      itemKind: "other",
      itemDescription: "Helmet",
      agreedTotal: "5000",
      schedule: { frequency: "monthly", dueDayOfMonth: "1", installmentAmount: "1000", firstDueDate: day(-5) },
    });
    const dup = await m.plans.recordPayment(clerk, plan.id, { amount: "1000", paidAt: day(0), receiptNumber: "7001" }).catch((e) => e);
    assert.ok(dup instanceof m.errors.ConflictError);
  });

  test("scenarios 4 and 5: sell for 200,000 on installments with 50,000 now; later 25,000", async () => {
    const { id } = await m.bikes.createBikePurchase(clerk, purchase({ engineNumber: "INST-1", purchasePrice: "160000", paidNow: "160000" }));
    const plan = await m.plans.createPlan(clerk, {
      customerId,
      relatedBikeId: id,
      agreementDate: day(-20),
      itemKind: "bike",
      itemDescription: "Honda CD70, Red, new",
      agreedTotal: "200000",
      advanceAmount: "50000",
      schedule: { frequency: "monthly", dueDayOfMonth: "10", installmentAmount: "25000", firstDueDate: day(-5) },
    });
    let bike = await m.bikes.getBike(viewer, id);
    assert.equal(bike.status, "sold");
    assert.equal(bike.saleDetail.mode, "installment");
    assert.equal(bike.saleDetail.price, 200000, "sale value recorded once");
    assert.equal(bike.saleDetail.plan.balance, 150000, "receivable 150,000");

    await m.plans.recordPayment(clerk, plan.id, { amount: "25000", paidAt: day(-1) });
    bike = await m.bikes.getBike(viewer, id);
    assert.equal(bike.saleDetail.price, 200000, "a later installment does not add to the sale");
    assert.equal(bike.saleDetail.plan.balance, 125000);

    const planView = await m.plans.getPlan(clerk, plan.id);
    assert.equal(planView.bike.bikeNumber, bike.bikeNumber);
  });

  test("a sold bike cannot be put on a second plan; selling needs bike permission", async () => {
    const { id } = await m.bikes.createBikePurchase(clerk, purchase({ engineNumber: "INST-2" }));
    const base = {
      customerId,
      relatedBikeId: id,
      agreementDate: day(-1),
      itemKind: "bike",
      itemDescription: "CD70",
      agreedTotal: "100000",
      advanceAmount: "100000",
      schedule: { frequency: "monthly", dueDayOfMonth: "1" },
    };
    const noBikePerm = staff("user", ["installments.create", "installments.view"]);
    await assert.rejects(m.plans.createPlan(noBikePerm, base), m.errors.ForbiddenError);
    await m.plans.createPlan(clerk, base);
    const again = await m.plans.createPlan(clerk, base).catch((e) => e);
    assert.ok(again instanceof m.errors.ValidationError);
  });

  test("cancelling a cash sale puts the bike back in stock (needs edit rights)", async () => {
    const { id } = await m.bikes.createBikePurchase(clerk, purchase({ engineNumber: "CASH-2" }));
    await m.bikes.sellBikeForCash(clerk, id, { customerId, saleDate: day(0), salePrice: "120000" });
    await assert.rejects(m.bikes.cancelCashSale(clerk, id, { reason: "wrong bike" }), m.errors.ForbiddenError);
    await m.bikes.cancelCashSale(admin, id, { reason: "Wrong bike selected" });
    const bike = await m.bikes.getBike(viewer, id);
    assert.equal(bike.status, "in_stock");
    assert.equal(bike.saleDetail, null);
  });
});

describe("bike lists, search and permissions", () => {
  test("list filters: in stock, sold, owed to seller", async () => {
    const stock = await m.bikes.listBikes(viewer, { status: "in_stock" });
    assert.ok(stock.items.every((b) => b.status === "in_stock"));
    const sold = await m.bikes.listBikes(viewer, { status: "sold" });
    assert.ok(sold.items.length > 0 && sold.items.every((b) => b.status === "sold"));
    const owed = await m.bikes.listBikes(viewer, { status: "owed" });
    assert.ok(owed.items.every((b) => b.payable > 0));
  });

  test("search by registration without spaces, and by stock number", async () => {
    const byReg = await m.bikes.searchBikes(viewer, "bjj4802");
    assert.equal(byReg.length, 1);
    const byNumber = await m.bikes.searchBikes(viewer, "B-1");
    assert.equal(byNumber[0].bikeNumber, 1);
  });

  test("viewers cannot buy, pay sellers or sell", async () => {
    await assert.rejects(m.bikes.createBikePurchase(viewer, purchase({ engineNumber: "V-1" })), m.errors.ForbiddenError);
    const [any] = (await m.bikes.listBikes(viewer, { status: "all" })).items;
    await assert.rejects(m.bikes.recordSellerPayment(viewer, any.id, { amount: "1", paidAt: day(0) }), m.errors.ForbiddenError);
    await assert.rejects(m.bikes.listBikes(staff("user", []), {}), m.errors.ForbiddenError);
  });

  test("details edit is audited; purchase price is not editable there", async () => {
    const { id } = await m.bikes.createBikePurchase(clerk, purchase({ engineNumber: "EDIT-1" }));
    await assert.rejects(m.bikes.updateBikeDetails(clerk, id, { ...purchase(), color: "Blue" }), m.errors.ForbiddenError);
    await m.bikes.updateBikeDetails(admin, id, { ...purchase({ engineNumber: "EDIT-1" }), color: "Blue", purchasePrice: "1" });
    const bike = await m.bikes.getBike(viewer, id);
    assert.equal(bike.color, "Blue");
    assert.equal(bike.purchase.price, 100000);
  });
});
