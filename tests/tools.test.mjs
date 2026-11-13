// Notifications, daily report (with Excel export) and customer import.
import { after, before, describe, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { startTestDb } from "./helpers.mjs";
import * as bd from "@/lib/business-date";
import { cellText, guessMapping, rowToRecord } from "@/lib/imports";

let db;
let m;
let owner; // a real Superadmin account (needed for the "seen" time)
const staff = (role, permissions = []) => ({ kind: "staff", id: new mongoose.Types.ObjectId().toHexString(), role, permissions, isActive: true });
const admin = staff("admin");
const cashier = staff("user", ["transactions.view"]);
const day = (n) => bd.dateOnlyString(bd.addDays(bd.parseDateOnly(bd.todayPk()), n));

before(async () => {
  db = await startTestDb();
  m = {
    users: await import("@/server/services/users"),
    customers: await import("@/server/services/customers"),
    plans: await import("@/server/services/installments"),
    cash: await import("@/server/services/cashbook"),
    notifications: await import("@/server/services/notifications"),
    reports: await import("@/server/services/reports"),
    excel: await import("@/server/services/reports/excel"),
    imports: await import("@/server/services/imports/customers"),
    errors: await import("@/server/errors"),
  };
  const sa = await m.users.createInitialSuperadmin({ name: "Owner", username: "owner", password: "owner-pass-1" });
  owner = { kind: "staff", id: sa.id, role: "superadmin", permissions: [], isActive: true };
});
after(async () => db?.stop());

describe("notifications", () => {
  let planId;
  before(async () => {
    const customerId = (await m.customers.createCustomer(admin, { name: "Late Customer", cnic: "31303-5555555-5", phones: ["0300-5555555"] })).id;
    // First installment was due 20 days ago and nothing was paid since the advance: overdue.
    planId = (
      await m.plans.createPlan(admin, {
        customerId,
        agreementDate: day(-50),
        itemKind: "bike",
        itemDescription: "CD70",
        agreedTotal: "150000",
        advanceAmount: "30000",
        advanceReceiptNumber: "500",
        schedule: { frequency: "monthly", dueDayOfMonth: "10", installmentAmount: "10000", firstDueDate: day(-20) },
      })
    ).id;
  });

  test("overdue alert and other staff's activity (unread) for the owner", async () => {
    const n = await m.notifications.getNotifications(owner);
    assert.ok(n.alerts.some((a) => a.key === "overdue" && a.href === "/plans?status=late"));
    assert.ok(n.canActivity);
    assert.ok(n.activity.some((a) => a.action === "plan.create" && a.entityId === planId));
    assert.ok(n.unreadActivity >= 2, "customer + plan created by someone else");
    assert.ok(n.badge >= n.unreadActivity + 1, "badge counts unread activity plus the overdue alert");
  });

  test("marking read clears unread; own actions never appear", async () => {
    await m.notifications.markNotificationsRead(owner);
    let n = await m.notifications.getNotifications(owner);
    assert.equal(n.unreadActivity, 0);
    await m.cash.createTransaction(owner, { type: "expense", category: "rent", amount: "1000", occurredAt: day(0), description: "Own entry" });
    n = await m.notifications.getNotifications(owner);
    assert.equal(n.activity.some((a) => a.action === "cashbook.create"), false, "the owner's own entry is not a notification");
    await m.cash.createTransaction(admin, { type: "expense", category: "rent", amount: "500", occurredAt: day(0), description: "Admin entry" });
    n = await m.notifications.getNotifications(owner);
    assert.equal(n.unreadActivity, 1);
  });

  test("people only see what their permissions allow; customers are refused", async () => {
    const n = await m.notifications.getNotifications(cashier);
    assert.equal(n.canActivity, false);
    assert.equal(n.activity.length, 0);
    assert.equal(n.alerts.length, 0, "no installment or bike permission, so no alerts");
    await assert.rejects(m.notifications.getNotifications({ kind: "customer", id: "x", isActive: true }), m.errors.ForbiddenError);
  });
});

describe("daily report", () => {
  test("cash for one day: opening, in, out, closing and the movements", async () => {
    const r = await m.reports.getDailyReport(owner, { date: day(0) });
    // Today so far: two expenses (1,000 + 500) from the notification tests.
    assert.equal(r.money.cashOut, 1500);
    assert.equal(r.money.closing, r.money.opening + r.money.net);
    assert.equal(r.entries.filter((e) => e.direction === "out").length, 2);
    assert.ok(Array.isArray(r.activity), "the owner sees the activity log");

    const earlier = await m.reports.getDailyReport(owner, { date: day(-50) });
    assert.equal(earlier.money.cashIn, 30000, "the advance was paid on the agreement day");
    assert.equal(earlier.plans.length, 0, "the plan was created today, not on its agreement date");
  });

  test("permissions, dates and the Excel file", async () => {
    const r = await m.reports.getDailyReport(cashier, { date: day(0) });
    assert.equal(r.activity, null, "no audit.view, no activity log");
    assert.equal(r.plans, null, "no installments.view, no plan list");
    await assert.rejects(m.reports.getDailyReport(staff("user", ["customers.view"]), {}), m.errors.ForbiddenError);
    await assert.rejects(m.reports.getDailyReport(owner, { date: day(1) }), m.errors.ValidationError);
    await assert.rejects(m.reports.getDailyReport(owner, { date: "12/11/2026" }), m.errors.ValidationError);

    const buffer = await m.excel.dailyReportWorkbook(await m.reports.getDailyReport(owner, { date: day(0) }));
    assert.ok(buffer.length > 1000);
    assert.equal(buffer.subarray(0, 2).toString(), "PK", "an .xlsx file is a zip archive");
  });
});

describe("customer import", () => {
  test("column matching and cell clean-up in the browser helpers", () => {
    const mapping = guessMapping(["Customer Name", "S/O", "ID Card", "Mobile", "Remarks"]);
    assert.equal(mapping.name, 0);
    assert.equal(mapping.fatherOrHusbandName, 1);
    assert.equal(mapping.cnic, 2);
    assert.equal(mapping.phone1, 3);
    assert.equal(mapping.notes, 4);
    assert.equal(cellText(3001234567, "phone1"), "03001234567", "Excel drops the leading 0");
    assert.equal(rowToRecord(["A", "", "3130312345671", 3001234567, ""], mapping).phone1, "03001234567");
  });

  test("check: ready, errors, existing customers and duplicates in the file", async () => {
    const rows = [
      { name: "New One", cnic: "31303-1111222-1", phone1: "0301-1111222" },
      { name: "", cnic: "31303-1111222-2" },
      { name: "Bad Cnic", cnic: "12345" },
      { name: "Already Here", cnic: "31303-5555555-5" },
      { name: "Twice", cnic: "31303-1111222-1" },
    ];
    const res = await m.imports.checkCustomerImport(admin, rows);
    assert.deepEqual(res.summary, { total: 5, ready: 1, duplicates: 2, errors: 2 });
    assert.equal(res.rows[3].status, "duplicate");
    assert.ok(res.rows[3].existingId);
    assert.match(res.rows[4].errors[0], /row 1/);
    assert.equal(JSON.stringify(res).includes("3130311112221"), false, "CNICs are not sent back");
  });

  test("import saves only ready rows, is audited, and running it again skips them", async () => {
    const rows = [
      { name: "Imported A", fatherOrHusbandName: "Father A", cnic: "31303-2222333-1", phone1: "0302-2222333", homeAddress: "RYK" },
      { name: "Imported B", cnic: "31303-2222333-2" },
      { name: "x", cnic: "31303-2222333-3" },
    ];
    const first = await m.imports.importCustomerChunk(admin, rows, { firstRow: 11 });
    assert.equal(first.created, 2);
    assert.equal(first.skipped.length, 1);
    assert.equal(first.skipped[0].row, 13, "row numbers point into the whole file");
    const again = await m.imports.importCustomerChunk(admin, rows, { firstRow: 11 });
    assert.equal(again.created, 0);
    assert.equal(again.skipped.filter((s) => s.status === "duplicate").length, 2);

    const list = await m.customers.listCustomers(owner, { q: "Imported" });
    assert.equal(list.total, 2);
  });

  test("permissions and limits", async () => {
    const viewer = staff("user", ["customers.view"]);
    await assert.rejects(m.imports.checkCustomerImport(viewer, [{ name: "A", cnic: "31303-9999999-9" }]), m.errors.ForbiddenError);
    await assert.rejects(m.imports.checkCustomerImport(admin, []), m.errors.ValidationError);
    const tooMany = Array.from({ length: 51 }, (_, i) => ({ name: `P ${i}`, cnic: `31303-77777${String(i).padStart(2, "0")}-1` }));
    await assert.rejects(m.imports.importCustomerChunk(admin, tooMany), m.errors.ValidationError);
  });
});
