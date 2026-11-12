// Document rules shared by the browser (upload form) and the server (which enforces them).
// Requirements: docs/01 section J and docs/02 section 2.8; size limit and removal: D-017.

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB per file

/** Allowed types: MIME type -> file extensions. Anything else is refused. */
export const DOCUMENT_TYPES = {
  "application/pdf": ["pdf"],
  "image/jpeg": ["jpg", "jpeg"],
  "image/png": ["png"],
  "image/webp": ["webp"],
};

export const ACCEPT_ATTRIBUTE = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";

/** Records that can hold documents, and the permission needed to see that record. */
export const DOCUMENT_OWNERS = {
  customer: { label: "Customer", viewPermission: "customers.view" },
  plan: { label: "Installment plan", viewPermission: "installments.view" },
  bike: { label: "Bike", viewPermission: "bikes.view" },
};

/** Document groups from the requirements (docs/01 J), plus bike photos (D-008). */
export const DOCUMENT_CATEGORIES = [
  { value: "identity", label: "Identity documents" },
  { value: "agreement", label: "Agreement & supporting documents" },
  { value: "purchase", label: "Bike purchase / seller documents" },
  { value: "registration", label: "Registration / transfer documents" },
  { value: "sale", label: "Bike sale / buyer documents" },
  { value: "proof", label: "Transaction proof" },
  { value: "photo", label: "Bike photo" },
  { value: "general", label: "General" },
];

export const DEFAULT_CATEGORY = { customer: "identity", plan: "agreement", bike: "photo" };

export function categoryLabel(value) {
  return DOCUMENT_CATEGORIES.find((c) => c.value === value)?.label ?? "General";
}

export function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function extensionOf(fileName) {
  const m = /\.([a-z0-9]+)$/i.exec(fileName ?? "");
  return m ? m[1].toLowerCase() : "";
}
