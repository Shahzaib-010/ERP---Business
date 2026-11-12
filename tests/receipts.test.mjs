// Phase 6 tests: receipts and vouchers.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { startTestDb } from "./helpers.mjs";
import { numberToWords, rupeesInWords } from "@/lib/amount-words";
import * as bd from "@/lib/business-date";

let db;
let m;
const staff = (role, permissions = []) => ({ kind: "staff", id: new mongoose.Types.ObjectId().toHexString(), role, permissions, isActive: true });
const owner = staff("superadmin");
const day = (n) => bd.dateOnlyString(bd.addDays(bd.parseDateOnly(bd.todayPk()), n));

before(async () => {
  db = await startTestDb();
  m = {
    receipts: await import("@/server/services/receipts"),
    plans: await import("@/server/services/installments"),
    bikes: await import("@/server/services/bikes"),
    cash: await import("@/server/services/cashbook"),
    customers: await import("@/server/services/customers"),
    errors: await import("@/server/errors"),
  };
});
after(async () => db?.stop());

describe("amounts in words (lakh / crore)", () => {
  test("examples from the paper cards", () => {
    assert.equal(rupeesInWords(155000), "One lakh fifty-five thousand rupees only");
    assert.equal(rupeesInWords(11000), "Eleven thousand rupees only");
    assert.equal(rupeesInWords(297000), "Two lakh ninety-seven thousand rupees only");
  });
  test("edge cases", () => {
    assert.equal(numberToWords(0), "zero");
    assert.equal(numberToWords(101), "one hundred one");
    assert.equal(numberToWords(1_00_00_000), "one crore");
    assert.equal(numberToWords(12_34_56_789), "twelve crore thirty-four lakh fifty-six thousand seven hundred eighty-nine");
  });
});

describe("receipts", () => {
  let customerId;
  let planId;

  before(async () => {
    customerId = (await m.customers.createCustomer(owner, { name: "Receipt Customer", cnic: "31303-8888888-8", phones: ["0300-1231234"] })).id;
    planId = (
      await m.plans.createPlan(owner, {
        customerId,
        agreementDate: day(-40),
        itemKind: "bike",
        itemDescription: "CD70",
        agreedTotal: "200000",
        advanceAmount: "70000",
        advanceReceiptNumber: "100",
        schedule: { frequency: "monthly", dueDayOfMonth: "10", installmentAmount: "11000", firstDueDate: day(-10) },
      })
    ).id;
  });

  test("installment receipt shows balance before and after, and masks the CNIC", async () => {
    const pay = await m.plans.recordPayment(owner, planId, { amount: "11000", paidAt: day(-5), receiptNumber: "101" });
    const r = await m.receipts.getPaymentReceipt(owner, pay.id);
    assert.equal(r.title, "Installment receipt");
    assert.equal(r.receiptNumber, 101);
    assert.equal(r.plan.balanceBefore, 130000);
    assert.equal(r.plan.balanceAfter, 119000);
    assert.equal(r.plan.paidToDate, 81000);
    assert.equal(r.customer.cnicMasked, "*****-***8888-8");
    assert.ok(!JSON.stringify(r).includes("3130388888888"), "full CNIC never on a receipt");
  });

  test("a voided payment's receipt is flagged void", async () => {
    const pay = await m.plans.recordPayment(owner, planId, { amount: "500", paidAt: day(-1) });
    await m.plans.voidPayment(owner, pay.id, { reason: "Wrong plan" });
    const r = await m.receipts.getPaymentReceipt(owner, pay.id);
    assert.equal(r.status, "voided");
    assert.equal(r.voidReason, "Wrong plan");
    assert.equal(r.plan.balanceAfter, r.plan.balanceBefore, "void changes nothing");
  });

  test("a settlement discount has no receipt", async () => {
    const plan = await m.plans.getPlan(owner, planId);
    await m.plans.recordPayment(owner, planId, { amount: String(plan.balance - 1000), paidAt: day(0) });
    await m.plans.applyDiscount(owner, planId, { reason: "Waived", paidAt: day(0) });
    const discount = (await m.plans.getPlan(owner, planId)).ledger.find((l) => l.kind === "discount");
    await assert.rejects(m.receipts.getPaymentReceipt(owner, discount.id), m.errors.NotFoundError);
  });

  test("cash bike sale receipt and seller voucher", async () => {
    const { id } = await m.bikes.createBikePurchase(owner, { make: "Honda", model: "CD70", condition: "new", engineNumber: "RCPT-1", sellerName: "Dealer", purchaseDate: day(-3), purchasePrice: "100000", paidNow: "60000" });
    await m.bikes.sellBikeForCash(owner, id, { customerId, saleDate: day(0), salePrice: "120000", receiptNumber: "102" });
    const sale = await m.receipts.getBikeSaleReceipt(owner, id);
    assert.equal(sale.amount, 120000);
    assert.equal(sale.receiptNumber, 102);
    assert.equal(sale.bike.engineNumber, "RCPT-1");

    const bike = await m.bikes.getBike(owner, id);
    const voucher = await m.receipts.getSellerVoucher(owner, bike.sellerPayments[0].id);
    assert.equal(voucher.amount, 60000);
    assert.equal(voucher.bike.owedAfter, 40000);
  });

  test("cash book voucher; unknown ids are not found", async () => {
    const { id } = await m.cash.createTransaction(owner, { type: "expense", category: "rent", amount: "45000", occurredAt: day(0), description: "Shop rent", voucherNumber: "R-11" });
    const v = await m.receipts.getCashbookVoucher(owner, id);
    assert.equal(v.title, "Payment voucher");
    assert.equal(v.voucherNumber, "R-11");
    assert.equal(v.categoryLabel, "Rent");
    await assert.rejects(m.receipts.getPaymentReceipt(owner, new mongoose.Types.ObjectId().toHexString()), m.errors.NotFoundError);
    await assert.rejects(m.receipts.getCashbookVoucher(owner, "nope"), m.errors.NotFoundError);
  });

  test("receipts need the receipts.view permission; customers never get them", async () => {
    const [p] = (await m.plans.getPlan(owner, planId)).ledger;
    await assert.rejects(m.receipts.getPaymentReceipt(staff("user", ["installments.view"]), p.id), m.errors.ForbiddenError);
    await assert.rejects(m.receipts.getPaymentReceipt({ kind: "customer", id: customerId }, p.id), m.errors.ForbiddenError);
    const ok = await m.receipts.getPaymentReceipt(staff("user", ["receipts.view"]), p.id);
    assert.equal(ok.receiptNumber, 100);
  });
});
