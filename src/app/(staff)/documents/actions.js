"use server";

import { refresh } from "next/cache";
import { formToObject, runAction } from "@/server/actions";
import { getStaffActor } from "@/server/auth/current";
import {
  confirmUpload,
  eraseDocument,
  removeDocument,
  restoreDocument,
  startUpload,
} from "@/server/services/documents";

// Each action re-reads the session; the documents service checks permissions itself.

/** Step 1: returns { documentId, uploadUrl, contentType } for the browser upload. */
export async function startUploadAction(input) {
  return runAction(async () => startUpload(await getStaffActor(), input));
}

/** Step 2: after the browser upload, check the stored file and list it. */
export async function confirmUploadAction(documentId) {
  const result = await runAction(async () => confirmUpload(await getStaffActor(), documentId));
  if (result.ok) refresh();
  return result;
}

export async function removeDocumentAction(documentId, _prev, formData) {
  const result = await runAction(async () => removeDocument(await getStaffActor(), documentId, formToObject(formData)));
  if (result.ok) refresh();
  return result;
}

export async function restoreDocumentAction(documentId) {
  const result = await runAction(async () => restoreDocument(await getStaffActor(), documentId));
  if (result.ok) refresh();
  return result;
}

export async function eraseDocumentAction(documentId, _prev, formData) {
  const result = await runAction(async () => eraseDocument(await getStaffActor(), documentId, formToObject(formData)));
  if (result.ok) refresh();
  return result;
}
