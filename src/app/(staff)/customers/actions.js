"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { formToObject, runAction } from "@/server/actions";
import { getStaffActor } from "@/server/auth/current";
import { createCustomer, updateCustomer } from "@/server/services/customers";
import { disableCustomerPortal, setCustomerPortalPassword } from "@/server/services/customers/portal-access";

// Each action re-reads the session; the services check permissions themselves.

const FORM_ARRAYS = { arrays: ["phones"] };

export async function createCustomerAction(_prev, formData) {
  const input = formToObject(formData, FORM_ARRAYS);
  const result = await runAction(async () => createCustomer(await getStaffActor(), input));
  if (result.ok) redirect(`/customers/${result.data.id}?saved=created`);
  return { ...result, values: input };
}

export async function updateCustomerAction(id, _prev, formData) {
  const input = formToObject(formData, FORM_ARRAYS);
  const result = await runAction(async () => updateCustomer(await getStaffActor(), id, input));
  if (result.ok) redirect(`/customers/${id}?saved=${result.data.changed ? "updated" : "unchanged"}`);
  return { ...result, values: input };
}

export async function setPortalPasswordAction(customerId, _prev, formData) {
  const result = await runAction(async () =>
    setCustomerPortalPassword(await getStaffActor(), customerId, formToObject(formData)),
  );
  if (result.ok) refresh();
  return result;
}

export async function disablePortalAction(customerId, _prev) {
  const result = await runAction(async () => disableCustomerPortal(await getStaffActor(), customerId));
  if (result.ok) refresh();
  return result;
}
