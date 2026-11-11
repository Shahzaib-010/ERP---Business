"use server";

import { formToObject, runAction } from "@/server/actions";
import { getStaffActor } from "@/server/auth/current";
import { changeOwnPassword } from "@/server/services/users";

export async function changeOwnPasswordAction(_prev, formData) {
  return runAction(async () => {
    const actor = await getStaffActor(); // the service rejects a missing actor
    await changeOwnPassword(actor, formToObject(formData));
  });
}
