"use server";

import { redirect } from "next/navigation";
import { formToObject, runAction } from "@/server/actions";
import {
  clearSessionCookie,
  getRequestMeta,
  readSessionToken,
  setSessionCookie,
} from "@/server/auth/current";
import { loginCustomer, loginStaff } from "@/server/services/auth/login";
import { deleteSessionByToken } from "@/server/services/auth/sessions";

export async function staffLoginAction(_prev, formData) {
  const input = formToObject(formData);
  const meta = await getRequestMeta();
  const result = await runAction(async () => {
    const { token, expiresAt } = await loginStaff(input, meta);
    await setSessionCookie(token, expiresAt);
  });
  if (result.ok) redirect("/dashboard");
  // Send back the username so the form keeps it. Never the password.
  return { ...result, values: { username: input.username ?? "" } };
}

export async function customerLoginAction(_prev, formData) {
  const input = formToObject(formData);
  const meta = await getRequestMeta();
  const result = await runAction(async () => {
    const { token, expiresAt } = await loginCustomer(input, meta);
    await setSessionCookie(token, expiresAt);
  });
  if (result.ok) redirect("/portal");
  return { ...result, values: { cnic: input.cnic ?? "" } };
}

/** Works for staff and customers. Deletes the session row, then the cookie. */
export async function logoutAction() {
  const token = await readSessionToken();
  await deleteSessionByToken(token);
  await clearSessionCookie();
  redirect("/");
}
