"use server";

import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { formToObject, runAction } from "@/server/actions";
import { getStaffActor } from "@/server/auth/current";
import { createStaff, resetStaffPassword, updateStaff } from "@/server/services/users";

// Each action re-reads the session; the services check "users.manage" themselves.

export async function createStaffAction(_prev, formData) {
  const input = formToObject(formData, { arrays: ["permissions"] });
  const result = await runAction(async () => createStaff(await getStaffActor(), input));
  if (result.ok) redirect(`/users/${result.data.id}?created=1`);
  return { ...result, values: { name: input.name, username: input.username, role: input.role, permissions: input.permissions } };
}

export async function updateStaffAction(id, _prev, formData) {
  const input = formToObject(formData, { arrays: ["permissions"], booleans: ["isActive"] });
  const result = await runAction(async () => updateStaff(await getStaffActor(), id, input));
  if (result.ok) refresh();
  return result;
}

export async function resetStaffPasswordAction(id, _prev, formData) {
  return runAction(async () =>
    resetStaffPassword(await getStaffActor(), id, formToObject(formData)),
  );
}
