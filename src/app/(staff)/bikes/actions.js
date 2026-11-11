"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { formToObject, runAction } from "@/server/actions";
import { getStaffActor } from "@/server/auth/current";
import {
  cancelCashSale,
  createBikePurchase,
  recordSellerPayment,
  sellBikeForCash,
  updateBikeDetails,
  voidSellerPayment,
} from "@/server/services/bikes";

// Each action re-reads the session; the services check permissions themselves.

export async function createBikeAction(_prev, formData) {
  const input = formToObject(formData);
  const result = await runAction(async () => createBikePurchase(await getStaffActor(), input));
  if (result.ok) redirect(`/bikes/${result.data.id}?saved=created`);
  return { ...result, values: input };
}

export async function updateBikeAction(bikeId, _prev, formData) {
  const input = formToObject(formData);
  const result = await runAction(async () => updateBikeDetails(await getStaffActor(), bikeId, input));
  if (result.ok) redirect(`/bikes/${bikeId}?saved=${result.data.changed ? "updated" : "unchanged"}`);
  return { ...result, values: input };
}

export async function paySellerAction(bikeId, _prev, formData) {
  const input = formToObject(formData);
  const result = await runAction(async () => recordSellerPayment(await getStaffActor(), bikeId, input));
  if (result.ok) refresh();
  return { ...result, values: input };
}

export async function voidSellerPaymentAction(paymentId, _prev, formData) {
  const result = await runAction(async () => voidSellerPayment(await getStaffActor(), paymentId, formToObject(formData)));
  if (result.ok) refresh();
  return result;
}

export async function sellCashAction(bikeId, _prev, formData) {
  const input = formToObject(formData);
  const result = await runAction(async () => sellBikeForCash(await getStaffActor(), bikeId, input));
  if (result.ok) refresh();
  return { ...result, values: input };
}

export async function cancelSaleAction(bikeId, _prev, formData) {
  const result = await runAction(async () => cancelCashSale(await getStaffActor(), bikeId, formToObject(formData)));
  if (result.ok) refresh();
  return result;
}
