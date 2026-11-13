import "server-only";
import { z } from "zod";
import { connectDB } from "@/server/db/mongoose";
import { Customer } from "@/server/models/Customer";
import { InstallmentPlan } from "@/server/models/InstallmentPlan";
import { Bike } from "@/server/models/Bike";
import { parseOrThrow } from "@/server/errors";
import { can, requirePermission } from "@/server/permissions";
import { countActivityByActor, listActivityBetween } from "@/server/services/audit";

// A busy day can have thousands of changes; the list shows the latest ones, the counts cover all.
export const ACTIVITY_LIMIT = 500;
import { cashTotals, collectEntries } from "@/server/services/cashbook";
import { addDays, dateOnlyString, parseDateOnly, todayPk } from "@/lib/business-date";

// Daily report: everything that happened on one business day (Pakistan time).
// Money comes from the same ledger as the cash book; activity comes from the audit log.
// Needs "transactions.view". The activity log is included only with "audit.view", and
// new plans / bikes only with their own view permissions.

const PK_OFFSET_MS = 5 * 3600e3; // Pakistan is UTC+5, no daylight saving

const dateSchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a valid date.")
    .optional()
    .refine((d) => !d || d <= todayPk(), "The report cannot be for a future date."),
});

export async function getDailyReport(actor, input = {}) {
  requirePermission(actor, "transactions.view");
  const { date = todayPk() } = parseOrThrow(dateSchema, input);
  await connectDB();

  const from = parseDateOnly(date); // business dates are stored as UTC midnight
  const to = addDays(from, 1);
  // Real timestamps (createdAt, audit) for the same Pakistan calendar day.
  const realFrom = new Date(from.getTime() - PK_OFFSET_MS);
  const realTo = new Date(to.getTime() - PK_OFFSET_MS);

  const showPlans = can(actor, "installments.view");
  const showBikes = can(actor, "bikes.view");
  const showActivity = can(actor, "audit.view");

  const [totals, before, entriesDesc, customers, plans, bought, sold, activityDesc, staffCounts] = await Promise.all([
    cashTotals({ from, to }),
    cashTotals({ to: from }),
    collectEntries({ from, to }),
    can(actor, "customers.view") ? Customer.find({ createdAt: { $gte: realFrom, $lt: realTo } }).select("name createdAt").sort({ createdAt: 1 }).lean() : null,
    showPlans
      ? InstallmentPlan.find({ createdAt: { $gte: realFrom, $lt: realTo } })
          .select("accountNumber customerId item terms.agreedTotal terms.advanceAmount createdAt")
          .sort({ createdAt: 1 })
          .lean()
      : null,
    showBikes ? Bike.find({ "purchase.date": { $gte: from, $lt: to } }).select("bikeNumber make model modelYear color purchase.price purchase.seller.name purchaseTotals").sort({ bikeNumber: 1 }).lean() : null,
    showBikes ? Bike.find({ "sale.date": { $gte: from, $lt: to } }).select("bikeNumber make model modelYear color sale").sort({ bikeNumber: 1 }).lean() : null,
    // Newest first so the latest changes are always included, then put back in time order.
    showActivity ? listActivityBetween(actor, { from: realFrom, to: realTo, limit: ACTIVITY_LIMIT, newestFirst: true }) : null,
    showActivity ? countActivityByActor(actor, { from: realFrom, to: realTo }) : null,
  ]);
  const activity = activityDesc ? [...activityDesc].reverse() : null;
  const activityTotal = staffCounts ? staffCounts.reduce((s, x) => s + x.count, 0) : 0;

  const names = new Map();
  const customerIds = [...(plans ?? []).map((p) => String(p.customerId)), ...(sold ?? []).map((b) => String(b.sale?.customerId))].filter(Boolean);
  if (customerIds.length) {
    const rows = await Customer.find({ _id: { $in: [...new Set(customerIds)] } }).select("name").lean();
    for (const r of rows) names.set(String(r._id), r.name);
  }

  const opening = before.net;
  const entries = [...entriesDesc].reverse(); // oldest first, like a day book


  return {
    date,
    isToday: date === todayPk(),
    previousDate: dateOnlyString(addDays(from, -1)),
    nextDate: date < todayPk() ? dateOnlyString(to) : null,
    generatedAt: new Date(),
    money: {
      opening,
      cashIn: totals.cashIn,
      cashOut: totals.cashOut,
      net: totals.net,
      closing: opening + totals.net,
      parts: totals.parts,
    },
    entries: entries.map((e) => ({
      id: e.id,
      date: e.date,
      direction: e.direction,
      amount: e.amount,
      sourceLabel: e.sourceLabel,
      categoryLabel: e.categoryLabel ?? null,
      title: e.title,
      detail: e.detail,
      reference: e.reference,
      href: e.href,
      receiptHref: e.receiptHref,
    })),
    customers: customers?.map((c) => ({ id: String(c._id), name: c.name, createdAt: c.createdAt })) ?? null,
    plans:
      plans?.map((p) => ({
        id: String(p._id),
        accountNumber: p.accountNumber,
        customerName: names.get(String(p.customerId)) ?? "—",
        item: p.item?.description ?? "",
        agreedTotal: p.terms?.agreedTotal ?? 0,
        advance: p.terms?.advanceAmount ?? 0,
      })) ?? null,
    bikesBought:
      bought?.map((b) => ({
        id: String(b._id),
        bikeNumber: b.bikeNumber,
        label: [b.make, b.model, b.modelYear, b.color].filter(Boolean).join(" "),
        seller: b.purchase?.seller?.name ?? "",
        price: b.purchase?.price ?? 0,
        owed: b.purchaseTotals?.payable ?? 0,
      })) ?? null,
    bikesSold:
      sold?.map((b) => ({
        id: String(b._id),
        bikeNumber: b.bikeNumber,
        label: [b.make, b.model, b.modelYear, b.color].filter(Boolean).join(" "),
        mode: b.sale?.mode,
        customerName: names.get(String(b.sale?.customerId)) ?? "—",
        price: b.sale?.price ?? 0,
      })) ?? null,
    activity:
      activity?.map((a) => ({
        id: a.id,
        action: a.action,
        actorName: a.actorName,
        entityType: a.entityType,
        entityId: a.entityId,
        entityName: a.entityName,
        createdAt: a.createdAt,
        reason: a.reason,
      })) ?? null,
    // Who did how much that day, counting every change (not only the ones listed).
    staff: staffCounts ?? [],
    activityTotal,
  };
}
