import "server-only";
import { connectDB } from "@/server/db/mongoose";
import { InstallmentPlan } from "@/server/models/InstallmentPlan";
import { Bike } from "@/server/models/Bike";
import { StaffUser } from "@/server/models/StaffUser";
import { can, requireStaffActor } from "@/server/permissions";
import { listActivityBetween } from "@/server/services/audit";
import { progressFromTotals } from "@/server/services/installments";
import { addDays, dateOnlyString, parseDateOnly, todayPk } from "@/lib/business-date";
import { formatPKR } from "@/lib/format";
import { ACTIVITY_ACTIONS } from "@/lib/notifications";

// The notification bell. Two parts:
// - alerts: worked out live from plans and bikes (nothing stored), shown only for modules
//   the person may see;
// - activity: what other staff did in the last 14 days (from the audit log, needs
//   "audit.view"); events after the person's "seen" time count as unread.

const ACTIVITY_DAYS = 14;
const DUE_SOON_DAYS = 3;
const MAX_EVENTS = 30;

async function installmentAlerts(today) {
  const plans = await InstallmentPlan.find({ status: "active" }).select("terms schedule totals status").lean();
  const todayDate = parseDateOnly(today);
  const soonLimit = addDays(todayDate, DUE_SOON_DAYS);
  let overdue = { count: 0, amount: 0 };
  let dueToday = { count: 0, amount: 0 };
  let dueSoon = { count: 0, amount: 0 };
  for (const plan of plans) {
    const p = progressFromTotals(plan, today);
    if (p.overdue) {
      overdue = { count: overdue.count + 1, amount: overdue.amount + p.overdue.amount };
    } else if (p.nextDue) {
      const due = new Date(p.nextDue.dueDate);
      if (dateOnlyString(due) === today) dueToday = { count: dueToday.count + 1, amount: dueToday.amount + p.nextDue.amount };
      else if (due > todayDate && due <= soonLimit) dueSoon = { count: dueSoon.count + 1, amount: dueSoon.amount + p.nextDue.amount };
    }
  }
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const alerts = [];
  if (overdue.count) {
    alerts.push({ key: "overdue", tone: "danger", title: `${plural(overdue.count, "plan is", "plans are")} overdue`, body: `${formatPKR(overdue.amount)} not paid on time`, href: "/plans?status=late" });
  }
  if (dueToday.count) {
    alerts.push({ key: "due-today", tone: "attention", title: `${plural(dueToday.count, "installment", "installments")} due today`, body: `${formatPKR(dueToday.amount)} expected today`, href: "/dashboard/installments" });
  }
  if (dueSoon.count) {
    alerts.push({ key: "due-soon", tone: "info", title: `${plural(dueSoon.count, "installment", "installments")} due in the next ${DUE_SOON_DAYS} days`, body: `${formatPKR(dueSoon.amount)} expected`, href: "/dashboard/installments" });
  }
  return alerts;
}

async function sellerAlerts() {
  const [row] = await Bike.aggregate([
    { $match: { "purchaseTotals.payable": { $gt: 0 } } },
    { $group: { _id: null, count: { $sum: 1 }, amount: { $sum: "$purchaseTotals.payable" } } },
  ]);
  if (!row?.count) return [];
  return [
    {
      key: "sellers",
      tone: "info",
      title: `${formatPKR(row.amount)} owed to sellers`,
      body: `On ${row.count} ${row.count === 1 ? "bike" : "bikes"}`,
      href: "/bikes?status=owed",
    },
  ];
}

export async function getNotifications(actor) {
  requireStaffActor(actor);
  await connectDB();
  const today = todayPk();
  const canActivity = can(actor, "audit.view");

  const [planAlerts, bikeAlerts, me, events] = await Promise.all([
    can(actor, "installments.view") ? installmentAlerts(today) : [],
    can(actor, "bikes.view") ? sellerAlerts() : [],
    StaffUser.findById(actor.id).select("notificationsSeenAt").lean(),
    canActivity
      ? listActivityBetween(actor, {
          from: new Date(Date.now() - ACTIVITY_DAYS * 24 * 3600e3),
          actions: ACTIVITY_ACTIONS,
          excludeActorId: actor.id,
          limit: MAX_EVENTS,
          newestFirst: true,
        })
      : [],
  ]);

  const seenAt = me?.notificationsSeenAt ?? null;
  const activity = events.map((e) => ({
    id: e.id,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    entityName: e.entityName,
    actorName: e.actorName,
    createdAt: e.createdAt,
    reason: e.reason,
    unread: !seenAt || new Date(e.createdAt) > new Date(seenAt),
  }));

  const alerts = [...planAlerts, ...bikeAlerts];
  const unreadActivity = activity.filter((a) => a.unread).length;
  return {
    alerts,
    activity,
    canActivity,
    unreadActivity,
    // Badge: unread team activity plus the overdue / due-today alerts that need action.
    badge: unreadActivity + alerts.filter((a) => a.tone === "danger" || a.tone === "attention").length,
  };
}

/** Everything up to now counts as read for this person. */
export async function markNotificationsRead(actor) {
  requireStaffActor(actor);
  await connectDB();
  await StaffUser.updateOne({ _id: actor.id }, { $set: { notificationsSeenAt: new Date() } });
  return { ok: true };
}
