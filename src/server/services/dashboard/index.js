import "server-only";
import { connectDB } from "@/server/db/mongoose";
import { Customer } from "@/server/models/Customer";
import { StaffUser } from "@/server/models/StaffUser";
import { can, requireStaffActor } from "@/server/permissions";
import { listRecentActivity } from "@/server/services/audit";
import { toListItem } from "@/server/services/customers";

// Dashboard figures. Each section is included only when the actor may see that module.
// Money figures (sales, cash, receivables) are added with Phases 3–5.

/** Start of the current month in Asia/Karachi (UTC+5, no DST), as a UTC Date. */
function startOfMonthPk(now = new Date(), monthsBack = 0) {
  const pk = new Date(now.getTime() + 5 * 3600 * 1000);
  return new Date(Date.UTC(pk.getUTCFullYear(), pk.getUTCMonth() - monthsBack, 1) - 5 * 3600 * 1000);
}

export async function getDashboardOverview(actor) {
  requireStaffActor(actor);
  await connectDB();
  const out = { customers: null, staff: null, activity: null };

  if (can(actor, "customers.view")) {
    const thisMonth = startOfMonthPk();
    const lastMonth = startOfMonthPk(new Date(), 1);
    const [total, addedThisMonth, addedLastMonth, portalEnabled, recent] = await Promise.all([
      Customer.countDocuments(),
      Customer.countDocuments({ createdAt: { $gte: thisMonth } }),
      Customer.countDocuments({ createdAt: { $gte: lastMonth, $lt: thisMonth } }),
      Customer.countDocuments({ portalEnabled: true }),
      Customer.find().sort({ createdAt: -1, _id: -1 }).limit(5).lean(),
    ]);
    out.customers = { total, addedThisMonth, addedLastMonth, portalEnabled, recent: recent.map(toListItem) };
  }

  if (can(actor, "users.manage")) {
    const [active, disabled] = await Promise.all([
      StaffUser.countDocuments({ isActive: true }),
      StaffUser.countDocuments({ isActive: false }),
    ]);
    out.staff = { active, disabled };
  }

  if (can(actor, "audit.view")) {
    out.activity = await listRecentActivity(actor, { limit: 8 });
  }

  return out;
}
