// Installment schedule and progress. Pure functions, shared by the server and the forms.
// All money is integer PKR. Business dates are Date objects at 00:00 UTC (see business-date.js).
//
// Rules (doc 01 §E, D-006, D-008):
//  - The agreed total is fixed; no interest. The advance is due on the agreement date.
//  - The suggested installment amount is guidance. Payments of any amount count towards the
//    schedule in order, so paying extra moves you ahead and paying less carries forward.
//  - An installment is late from the day after its due date (no grace days). "Days late" is
//    counted from the oldest installment that is not fully covered.
//  - A Superadmin discount closes the remaining balance; it counts as settled, not as cash.

import { addDays, daysBetween, monthDay, parseDateOnly, toDateOnly } from "./business-date";

export const FREQUENCIES = ["monthly", "weekly", "daily", "custom"];
export const FREQUENCY_LABELS = { monthly: "Monthly", weekly: "Weekly", daily: "Daily", custom: "Every N days" };
const MAX_ROWS = 1000;

/** The i-th due date (i = 0 for the first installment). */
export function dueDateAt(schedule, i) {
  const first = toDateOnly(new Date(schedule.firstDueDate));
  switch (schedule.frequency) {
    case "weekly":
      return addDays(first, 7 * i);
    case "daily":
      return addDays(first, i);
    case "custom":
      return addDays(first, Math.max(1, schedule.intervalDays || 1) * i);
    case "monthly":
    default:
      // The first installment is due exactly on the date agreed; later ones on the due day.
      return i === 0 ? first : monthDay(first, i, schedule.dueDayOfMonth || first.getUTCDate());
  }
}

/** Default first due date: one period after the agreement (monthly: next month on the due day). */
export function suggestFirstDueDate(agreementDate, { frequency = "monthly", dueDayOfMonth, intervalDays } = {}) {
  const start = parseDateOnly(agreementDate) ?? toDateOnly(new Date(agreementDate));
  switch (frequency) {
    case "weekly":
      return addDays(start, 7);
    case "daily":
      return addDays(start, 1);
    case "custom":
      return addDays(start, Math.max(1, intervalDays || 1));
    default:
      return monthDay(start, 1, dueDayOfMonth || start.getUTCDate());
  }
}

/** Number of installments needed to pay `remaining` at `amount` each. */
export function installmentCount(remaining, amount) {
  if (!(amount > 0) || !(remaining > 0)) return 0;
  return Math.min(MAX_ROWS, Math.ceil(remaining / amount));
}

/**
 * Expected rows: the advance (row 0, due on the agreement date) and each installment.
 * Without an installment amount there is no schedule beyond the advance.
 */
export function buildRows({ agreedTotal, advanceAmount = 0, agreementDate, schedule }) {
  const rows = [];
  if (advanceAmount > 0) {
    rows.push({ n: 0, label: "Advance", dueDate: toDateOnly(new Date(agreementDate)), amount: advanceAmount });
  }
  const remaining = agreedTotal - advanceAmount;
  const amount = schedule?.installmentAmount;
  const count = schedule?.firstDueDate ? installmentCount(remaining, amount) : 0;
  for (let i = 0; i < count; i++) {
    rows.push({
      n: i + 1,
      label: `Installment ${i + 1}`,
      dueDate: dueDateAt(schedule, i),
      amount: Math.min(amount, remaining - amount * i),
    });
  }
  return rows;
}

/** Sum of posted payments by kind. */
export function totals(payments) {
  const t = { cash: 0, advance: 0, installments: 0, discount: 0 };
  for (const p of payments) {
    if (p.status && p.status !== "posted") continue;
    if (p.kind === "discount") t.discount += p.amount;
    else {
      t.cash += p.amount;
      if (p.kind === "advance") t.advance += p.amount;
      else t.installments += p.amount;
    }
  }
  return t;
}

/**
 * Where a plan stands today.
 * plan: { agreedTotal, advanceAmount, agreementDate, schedule, status }
 * payments: [{ kind: "advance" | "installment" | "discount", amount, status }]
 */
export function computeProgress(plan, payments, today) {
  const t = totals(payments);
  const settled = t.cash + t.discount;
  const balance = Math.max(0, plan.agreedTotal - settled);
  const todayDate = toDateOnly(today instanceof Date ? today : parseDateOnly(today));

  let cover = settled;
  const rows = buildRows(plan).map((row) => {
    const paidTowards = Math.max(0, Math.min(row.amount, cover));
    cover -= paidTowards;
    let status;
    if (paidTowards >= row.amount) status = "paid";
    else if (todayDate > row.dueDate) status = "late";
    else if (todayDate.getTime() === row.dueDate.getTime()) status = "due";
    else status = paidTowards > 0 ? "partial" : "upcoming";
    return { ...row, paidTowards, status };
  });

  let overdue = null;
  if (balance > 0 && plan.status !== "cancelled") {
    const late = rows.filter((r) => r.status === "late");
    if (late.length) {
      overdue = {
        since: late[0].dueDate,
        daysLate: daysBetween(late[0].dueDate, todayDate),
        amount: late.reduce((sum, r) => sum + (r.amount - r.paidTowards), 0),
        installments: late.length,
      };
    }
  }

  const next = balance > 0 ? rows.find((r) => r.status !== "paid" && r.status !== "late") : null;
  const scheduled = rows.filter((r) => r.n > 0);

  return {
    paid: t.cash,
    advancePaid: t.advance,
    installmentsPaid: t.installments,
    discount: t.discount,
    settled,
    balance,
    percent: plan.agreedTotal > 0 ? Math.min(100, Math.round((settled / plan.agreedTotal) * 100)) : 0,
    rows,
    overdue,
    nextDue: next ? { dueDate: next.dueDate, amount: next.amount - next.paidTowards, label: next.label } : null,
    installmentCount: scheduled.length,
    targetEndDate: scheduled.length ? scheduled[scheduled.length - 1].dueDate : null,
  };
}
