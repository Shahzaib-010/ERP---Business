"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/server/actions";
import { getStaffActor } from "@/server/auth/current";
import { checkCustomerImport, importCustomerChunk } from "@/server/services/imports/customers";

// Each call re-reads the session; the import service checks "customers.create" itself.

export async function checkCustomerImportAction(rows) {
  return runAction(async () => checkCustomerImport(await getStaffActor(), rows));
}

export async function importCustomerChunkAction(rows, firstRow) {
  const result = await runAction(async () => importCustomerChunk(await getStaffActor(), rows, { firstRow }));
  if (result.ok && result.data.created > 0) revalidatePath("/customers");
  return result;
}
