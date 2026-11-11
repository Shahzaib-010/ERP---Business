// Phase 4 acceptance tests: installment schedule engine and plan/payment services.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { startTestDb } from "./helpers.mjs";
import * as sched from "@/lib/installment-schedule";
import * as bd from "@/lib/business-date";

let db;
let mods;

const staff = (role, permissions = []) => ({
  kind: "staff",
  id: new mongoose.Types.ObjectId().toHexString(),
  role,
  permissions,
  isActive: true,
});
const owner = staff("superadmin");
const admin = staff("admin");
const clerk = staff("user", ["installments.view", "installments.create", "payments.create", "customers.view"]);
const viewer = staff("user", ["installments.view"]);

before(async () => {
  db = await startTestDb();
  mods = {
    plans: await import("@/server/services/installments"),
    customers: await import("@/server/services/customers"),
    errors: await import("@/server/errors"),
    Plan: (await import("@/server/models/InstallmentPlan")).InstallmentPlan,
    Payment: (await import("@/server/models/Payment")).Payment,
    AuditLog: (await import("@/server/models/AuditLog")).AuditLog,
  };
});
after(async () => db?.stop());

/** "YYYY-MM-DD" n days from today (Pakistan date). */
const day = (n) => bd.dateOnlyString(bd.addDays(bd.parseDateOnly(bd.todayPk()), n));
const D = (s) => bd.parseDateOnly(s);

// ---------------------------------------------------------------- schedule engine

describe("schedule engine", () => {
  const plan = {
    agreedTotal: 200000,
    advanceAmount: 70000,
    agreementDate: D("2026-09-01"),
    status: "active",
    schedule: { frequency: "monthly", dueDayOfMonth: 10, installmentAmount: 11000, firstDueDate: D("2026-10-10") },
  };

  test("paper sample A: 130,000 after advance at 11,000 = 12 installments, last one 9,000", () => {
    const rows = sched.buildRows(plan);
    assert.equal(rows[0].label, "Advance");
    assert.equal(rows.length, 13);
    assert.equal(rows[12].amount, 130000 - 11000 * 11);
    assert.equal(bd.dateOnlyString(rows[1].dueDate), "2026-10-10");
    assert.equal(bd.dateOnlyString(rows[12].dueDate), "2027-09-10");
  });

  test("monthly due day 31 falls on the last day of short months", () => {
    const s = { frequency: "monthly", dueDayOfMonth: 31, firstDueDate: D("2026-01-31") };
    assert.equal(bd.dateOnlyString(sched.dueDateAt(s, 1)), "2026-02-28");
    assert.equal(bd.dateOnlyString(sched.dueDateAt(s, 2)), "2026-03-31");
    assert.equal(bd.dateOnlyString(sched.dueDateAt(s, 3)), "2026-04-30");
  });

  test("weekly, daily and custom intervals", () => {
    const first = D("2026-01-01");
    assert.equal(bd.dateOnlyString(sched.dueDateAt({ frequency: "weekly", firstDueDate: first }, 2)), "2026-01-15");
    assert.equal(bd.dateOnlyString(sched.dueDateAt({ frequency: "daily", firstDueDate: first }, 3)), "2026-01-04");
    assert.equal(bd.dateOnlyString(sched.dueDateAt({ frequency: "custom", intervalDays: 10, firstDueDate: first }, 2)), "2026-01-21");
  });

  test("on time: nothing is late", () => {
    const p = sched.computeProgress(plan, [{ kind: "advance", amount: 70000 }, { kind: "installment", amount: 11000 }], "2026-10-15");
    assert.equal(p.overdue, null);
    assert.equal(p.balance, 119000);
    assert.equal(bd.dateOnlyString(p.nextDue.dueDate), "2026-11-10");
  });

  test("late from the day after the due day (no grace days)", () => {
    const onDueDay = sched.computeProgress(plan, [{ kind: "advance", amount: 70000 }], "2026-10-10");
    assert.equal(onDueDay.overdue, null);
    assert.equal(onDueDay.rows[1].status, "due");
    const dayAfter = sched.computeProgress(plan, [{ kind: "advance", amount: 70000 }], "2026-10-11");
    assert.equal(dayAfter.overdue.daysLate, 1);
    assert.equal(dayAfter.overdue.amount, 11000);
  });

  test("small payments carry forward; days late counts from the oldest unpaid installment", () => {
    const p = sched.computeProgress(
      plan,
      [{ kind: "advance", amount: 70000 }, { kind: "installment", amount: 5000 }, { kind: "installment", amount: 5000 }],
      "2026-11-20",
    );
    // 10,000 paid against 22,000 due: installment 1 is 1,000 short, installment 2 unpaid.
    assert.equal(p.overdue.amount, 12000);
    assert.equal(bd.dateOnlyString(p.overdue.since), "2026-10-10");
    assert.equal(p.overdue.daysLate, 41);
    assert.equal(p.rows[1].status, "late");
  });

  test("paying ahead moves the plan forward and is never late", () => {
    const p = sched.computeProgress(plan, [{ kind: "advance", amount: 70000 }, { kind: "installment", amount: 40000 }], "2026-12-20");
    assert.equal(p.overdue, null);
    assert.equal(p.rows.filter((r) => r.status === "paid").length, 4); // advance + 3 installments
    assert.equal(p.rows[4].paidTowards, 7000);
  });

  test("a discount settles the balance: completed, nothing late", () => {
    const p = sched.computeProgress(plan, [{ kind: "advance", amount: 70000 }, { kind: "installment", amount: 129000 }, { kind: "discount", amount: 1000 }], "2030-01-01");
    assert.equal(p.balance, 0);
    assert.equal(p.paid, 199000);
    assert.equal(p.discount, 1000);
    assert.equal(p.overdue, null);
    assert.equal(p.nextDue, null);
  });

  test("voided payments do not count", () => {
    const p = sched.computeProgress(plan, [{ kind: "advance", amount: 70000 }, { kind: "installment", amount: 11000, status: "voided" }], "2026-10-05");
    assert.equal(p.paid, 70000);
  });
});

// ---------------------------------------------------------------- services

describe("plans and payments", () => {
  let ali;
  let bilal;

  before(async () => {
    ali = (await mods.customers.createCustomer(owner, { name: "Ali Raza", cnic: "31303-1111111-1" })).id;
    bilal = (await mods.customers.createCustomer(owner, { name: "Bilal Ahmed", cnic: "31303-2222222-2" })).id;
  });

  const base = (over = {}) => ({
    customerId: ali,
    agreementDate: day(-60),
    itemKind: "bike",
    itemDescription: "CD70 Dream 2026",
    agreedTotal: "40,000",
    advanceAmount: "0",
    schedule: { frequency: "monthly", dueDayOfMonth: "10", installmentAmount: "10000", firstDueDate: day(-30) },
    ...over,
  });

  test("scenario 2: Rs 40,000 plan, receive Rs 20,000 -> Rs 20,000 outstanding", async () => {
    const { id } = await mods.plans.createPlan(clerk, base());
    await mods.plans.recordPayment(clerk, id, { amount: "20000", paidAt: day(-20) });
    const plan = await mods.plans.getPlan(viewer, id);
    assert.equal(plan.balance, 20000);
    assert.equal(plan.cashReceived, 20000);
    assert.equal(plan.status, "active");
  });

  test("scenario 3: another payment on a different date updates balance and history", async () => {
    const { id } = await mods.plans.createPlan(clerk, base());
    await mods.plans.recordPayment(clerk, id, { amount: "15000", paidAt: day(-25) });
    await mods.plans.recordPayment(clerk, id, { amount: "7000", paidAt: day(-5) });
    const plan = await mods.plans.getPlan(viewer, id);
    assert.equal(plan.balance, 18000);
    assert.deepEqual(plan.ledger.map((l) => l.balanceAfter), [25000, 18000]);
  });

  test("full upfront: advance = total completes the plan at once", async () => {
    const { id } = await mods.plans.createPlan(clerk, base({ advanceAmount: "40000", schedule: { frequency: "monthly", dueDayOfMonth: "10" } }));
    const plan = await mods.plans.getPlan(viewer, id);
    assert.equal(plan.status, "completed");
    assert.equal(plan.balance, 0);
    assert.equal(plan.ledger[0].kind, "advance");
  });

  test("partial advance is recorded as a payment on the agreement date", async () => {
    const { id } = await mods.plans.createPlan(clerk, base({ advanceAmount: "10000", advanceReceiptNumber: "501" }));
    const plan = await mods.plans.getPlan(viewer, id);
    assert.equal(plan.balance, 30000);
    assert.equal(plan.ledger[0].receiptNumber, 501);
    assert.equal(bd.dateOnlyString(plan.ledger[0].paidAt), day(-60));
  });

  test("final payment of the exact balance completes the plan; one rupee more is refused", async () => {
    const { id } = await mods.plans.createPlan(clerk, base());
    await mods.plans.recordPayment(clerk, id, { amount: "33000", paidAt: day(-10) });
    const over = await mods.plans.recordPayment(clerk, id, { amount: "7001", paidAt: day(-1) }).catch((e) => e);
    assert.ok(over instanceof mods.errors.ValidationError);
    assert.ok(over.fieldErrors.amount);
    const res = await mods.plans.recordPayment(clerk, id, { amount: "7000", paidAt: day(-1) });
    assert.equal(res.completed, true);
    await assert.rejects(mods.plans.recordPayment(clerk, id, { amount: "1", paidAt: day(0) }), mods.errors.ValidationError);
  });

  test("small and late payments show how late the plan is", async () => {
    const { id } = await mods.plans.createPlan(
      clerk,
      base({ schedule: { frequency: "monthly", dueDayOfMonth: "1", installmentAmount: "10000", firstDueDate: day(-45) } }),
    );
    await mods.plans.recordPayment(clerk, id, { amount: "3000", paidAt: day(-40) });
    const plan = await mods.plans.getPlan(viewer, id);
    assert.ok(plan.progress.overdue, "should be late");
    assert.equal(plan.progress.overdue.daysLate, 45);
  });

  test("scenario 1: one customer, two plans, both listed for the customer", async () => {
    const one = await mods.plans.createPlan(clerk, base({ customerId: bilal, itemDescription: "Fridge" , itemKind: "appliance" }));
    const two = await mods.plans.createPlan(clerk, base({ customerId: bilal, itemDescription: "Mobile phone", itemKind: "mobile" }));
    const list = await mods.plans.listPlansForCustomer(viewer, bilal);
    assert.deepEqual(new Set(list.map((p) => p.id)), new Set([one.id, two.id]));
  });

  test("account numbers continue after the highest paper number", async () => {
    const paper = await mods.plans.createPlan(clerk, base({ accountNumber: "2432" }));
    assert.equal(paper.accountNumber, 2432);
    const next = await mods.plans.createPlan(clerk, base());
    assert.equal(next.accountNumber, 2433);
    const { accountNumber } = await mods.plans.getNextNumbers(clerk);
    assert.equal(accountNumber, 2434);
    const dup = await mods.plans.createPlan(clerk, base({ accountNumber: "2432" })).catch((e) => e);
    assert.ok(dup instanceof mods.errors.ConflictError);
    assert.ok(dup.fieldErrors.accountNumber);
  });

  test("receipt numbers are unique among posted payments and continue the series", async () => {
    const { id } = await mods.plans.createPlan(clerk, base());
    await mods.plans.recordPayment(clerk, id, { amount: "1000", paidAt: day(-3), receiptNumber: "9001" });
    const dup = await mods.plans.recordPayment(clerk, id, { amount: "1000", paidAt: day(-2), receiptNumber: "9001" }).catch((e) => e);
    assert.ok(dup instanceof mods.errors.ConflictError);
    const { receiptNumber } = await mods.plans.getNextNumbers(clerk);
    assert.equal(receiptNumber, 9002);
    const plan = await mods.plans.getPlan(viewer, id);
    assert.equal(plan.balance, 39000, "the refused payment left no trace");
  });

  test("validation: advance above total, future dates and missing amounts", async () => {
    const e1 = await mods.plans.createPlan(clerk, base({ advanceAmount: "50000" })).catch((e) => e);
    assert.ok(e1.fieldErrors.advanceAmount);
    const e2 = await mods.plans.createPlan(clerk, base({ agreementDate: day(3) })).catch((e) => e);
    assert.ok(e2.fieldErrors.agreementDate);
    const e3 = await mods.plans.createPlan(clerk, base({ schedule: { frequency: "monthly", dueDayOfMonth: "10" } })).catch((e) => e);
    assert.ok(e3.fieldErrors["schedule.installmentAmount"]);
    const e4 = await mods.plans.createPlan(clerk, base({ cashPrice: "45000" })).catch((e) => e);
    assert.ok(e4.fieldErrors.cashPrice);
  });

  test("scenario 9: voiding a payment keeps it in history and restores the balance", async () => {
    const { id } = await mods.plans.createPlan(clerk, base());
    const pay = await mods.plans.recordPayment(clerk, id, { amount: "40000", paidAt: day(-1) });
    assert.equal((await mods.plans.getPlan(viewer, id)).status, "completed");
    await assert.rejects(mods.plans.voidPayment(clerk, pay.id, { reason: "typo" }), mods.errors.ForbiddenError);
    await mods.plans.voidPayment(admin, pay.id, { reason: "Wrong amount entered" });
    const plan = await mods.plans.getPlan(viewer, id);
    assert.equal(plan.status, "active", "re-opened");
    assert.equal(plan.balance, 40000);
    assert.equal(plan.ledger.length, 1);
    assert.equal(plan.ledger[0].status, "voided");
    assert.equal(plan.ledger[0].voidReason, "Wrong amount entered");
    const audit = await mods.AuditLog.findOne({ action: "payment.void", entityId: new mongoose.Types.ObjectId(id) }).lean();
    assert.equal(audit.reason, "Wrong amount entered");
    assert.equal(audit.before.amount, 40000);
  });

  test("discount: Superadmin only, closes the balance, not counted as cash", async () => {
    const { id } = await mods.plans.createPlan(clerk, base());
    await mods.plans.recordPayment(clerk, id, { amount: "39000", paidAt: day(-2) });
    await assert.rejects(mods.plans.applyDiscount(admin, id, { reason: "Good customer", paidAt: day(0) }), mods.errors.ForbiddenError);
    const res = await mods.plans.applyDiscount(owner, id, { reason: "Last 1000 waived", paidAt: day(0) });
    assert.equal(res.amount, 1000);
    const plan = await mods.plans.getPlan(viewer, id);
    assert.equal(plan.status, "completed");
    assert.equal(plan.cashReceived, 39000);
    assert.equal(plan.discount, 1000);
    const discountRow = plan.ledger.find((l) => l.kind === "discount");
    await assert.rejects(mods.plans.voidPayment(admin, discountRow.id, { reason: "undo" }), mods.errors.ForbiddenError);
  });

  test("schedule change is audited and leaves the original terms untouched", async () => {
    const { id } = await mods.plans.createPlan(clerk, base());
    await assert.rejects(mods.plans.updateSchedule(clerk, id, { frequency: "monthly", dueDayOfMonth: "15", installmentAmount: "10000", firstDueDate: day(-30) }), mods.errors.ForbiddenError);
    await mods.plans.updateSchedule(admin, id, { frequency: "monthly", dueDayOfMonth: "15", installmentAmount: "8000", firstDueDate: day(-30) });
    const plan = await mods.plans.getPlan(viewer, id);
    assert.equal(plan.schedule.dueDayOfMonth, 15);
    assert.equal(plan.schedule.installmentAmount, 8000);
    assert.equal(plan.terms.schedule.dueDayOfMonth, 10, "original agreement kept");
    assert.equal(plan.terms.schedule.installmentAmount, 10000);
  });

  test("guarantors are optional and stored on the plan; CNIC is masked when read", async () => {
    const { id } = await mods.plans.createPlan(
      clerk,
      base({ guarantors: [{ name: "Usman Majeed", phone: "0303-3852503", cnic: "31303-9999999-9" }, { name: "" }] }),
    );
    const plan = await mods.plans.getPlan(viewer, id);
    assert.equal(plan.guarantors.length, 1);
    assert.equal(plan.guarantors[0].cnicMasked, "*****-***9999-9");
    assert.deepEqual(plan.guarantors[0].phones, ["03033852503"]);
  });

  test("permissions: viewers cannot create or take payments", async () => {
    await assert.rejects(mods.plans.createPlan(viewer, base()), mods.errors.ForbiddenError);
    const { id } = await mods.plans.createPlan(clerk, base());
    await assert.rejects(mods.plans.recordPayment(viewer, id, { amount: "100", paidAt: day(0) }), mods.errors.ForbiddenError);
    await assert.rejects(mods.plans.listPlans(staff("user", []), {}), mods.errors.ForbiddenError);
  });

  test("list: search by account number and by customer name, and the late filter", async () => {
    const byNumber = await mods.plans.listPlans(viewer, { q: "2432" });
    assert.equal(byNumber.items[0].accountNumber, 2432);
    const byName = await mods.plans.listPlans(viewer, { q: "bilal" });
    assert.ok(byName.items.length >= 2 && byName.items.every((p) => p.customer.name === "Bilal Ahmed"));
    const late = await mods.plans.listPlans(viewer, { status: "late" });
    assert.ok(late.items.length > 0 && late.items.every((p) => p.overdue));
  });

  test("scenarios 10/11: a customer sees only their own plans", async () => {
    const mine = await mods.plans.getMyPlans({ kind: "customer", id: bilal });
    assert.ok(mine.length >= 2);
    assert.ok(mine.every((p) => typeof p.accountNumber === "number"));
    const all = await mods.Plan.find({ customerId: bilal }).countDocuments();
    assert.equal(mine.length, all);
    await assert.rejects(mods.plans.getMyPlans(viewer), mods.errors.ForbiddenError);
    await assert.rejects(mods.plans.getPlan({ kind: "customer", id: bilal }, mine[0].id), mods.errors.ForbiddenError);
  });
});
