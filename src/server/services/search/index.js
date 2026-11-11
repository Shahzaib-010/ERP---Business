import "server-only";
import { can, requireStaffActor } from "@/server/permissions";
import { searchCustomers } from "@/server/services/customers";
import { searchPlans } from "@/server/services/installments";
import { searchBikes } from "@/server/services/bikes";

// Universal search (doc 01 §C, D-007). Staff only. Each group of results is included only
// when the actor has that module's view permission, so a User never sees records from a
// module they cannot open.
//
// Later phases add groups here: installment plans by account number (Phase 4), bikes by
// engine/chassis/registration (Phase 3), payments by receipt number (Phase 6).

export async function universalSearch(actor, rawQuery) {
  requireStaffActor(actor);
  const q = String(rawQuery ?? "").trim().slice(0, 100);
  const groups = [];
  if (!q) return { q, groups, searchable: searchableTypes(actor) };

  if (can(actor, "bikes.view")) {
    const bikes = await searchBikes(actor, q, { limit: 8 });
    if (bikes.length) groups.push({ type: "bikes", label: "Bikes", items: bikes });
  }
  if (can(actor, "installments.view")) {
    const plans = await searchPlans(actor, q, { limit: 10 });
    if (plans.length) groups.push({ type: "plans", label: "Installment plans", items: plans });
  }
  if (can(actor, "customers.view")) {
    groups.push({ type: "customers", label: "Customers", items: await searchCustomers(actor, q, { limit: 20 }) });
  }

  return { q, groups, searchable: searchableTypes(actor) };
}

/** What this actor's search box can find, for the hint text. */
export function searchableTypes(actor) {
  const out = [];
  if (can(actor, "customers.view")) out.push("customer name, CNIC or phone");
  if (can(actor, "installments.view")) out.push("account number");
  if (can(actor, "bikes.view")) out.push("registration, engine or chassis number");
  return out;
}
