"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { formToNestedObject, formToObject, runAction } from "@/server/actions";
import { getStaffActor } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { searchCustomers } from "@/server/services/customers";
import {
  applyDiscount,
  createPlan,
  recordPayment,
  updatePlanDetails,
  updateSchedule,
  voidPayment,
} from "@/server/services/installments";

// Each action re-reads the session; the services check permissions themselves.

export async function createPlanAction(_prev, formData) {
  const input = formToNestedObject(formData);
  const result = await runAction(async () => createPlan(await getStaffActor(), input));
  if (result.ok) redirect(`/plans/${result.data.id}?saved=created`);
  return { ...result, values: input };
}

export async function updatePlanDetailsAction(planId, _prev, formData) {
  const input = formToNestedObject(formData);
  const result = await runAction(async () => updatePlanDetails(await getStaffActor(), planId, input));
  if (result.ok) redirect(`/plans/${planId}?saved=${result.data.changed ? "updated" : "unchanged"}`);
  return { ...result, values: input };
}

export async function recordPaymentAction(planId, _prev, formData) {
  const input = formToObject(formData);
  const result = await runAction(async () => recordPayment(await getStaffActor(), planId, input));
  if (result.ok) refresh();
  return { ...result, values: input };
}

export async function updateScheduleAction(planId, _prev, formData) {
  const input = formToObject(formData);
  const result = await runAction(async () => updateSchedule(await getStaffActor(), planId, input));
  if (result.ok) refresh();
  return { ...result, values: input };
}

export async function applyDiscountAction(planId, _prev, formData) {
  const input = formToObject(formData);
  const result = await runAction(async () => applyDiscount(await getStaffActor(), planId, input));
  if (result.ok) refresh();
  return { ...result, values: input };
}

export async function voidPaymentAction(paymentId, _prev, formData) {
  const input = formToObject(formData);
  const result = await runAction(async () => voidPayment(await getStaffActor(), paymentId, input));
  if (result.ok) refresh();
  return result;
}

/** Customer search for the plan form's customer picker. */
export async function findCustomersAction(q) {
  const actor = await getStaffActor();
  if (!actor || !can(actor, "customers.view") || typeof q !== "string" || q.trim().length < 2) return [];
  try {
    return await searchCustomers(actor, q, { limit: 8 });
  } catch {
    return [];
  }
}
