"use server";

import { refresh } from "next/cache";
import { formToObject, runAction } from "@/server/actions";
import { getStaffActor } from "@/server/auth/current";
import { createTransaction, voidTransaction } from "@/server/services/cashbook";

// Each action re-reads the session; the services check permissions themselves.

export async function createTransactionAction(_prev, formData) {
  const input = formToObject(formData);
  const result = await runAction(async () => createTransaction(await getStaffActor(), input));
  if (result.ok) refresh();
  return { ...result, values: input };
}

export async function voidTransactionAction(id, _prev, formData) {
  const result = await runAction(async () => voidTransaction(await getStaffActor(), id, formToObject(formData)));
  if (result.ok) refresh();
  return result;
}
