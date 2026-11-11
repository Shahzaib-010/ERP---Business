// CNIC helpers shared by server and forms. A Pakistani CNIC has 13 digits: XXXXX-XXXXXXX-X.

/** Keep digits only. Returns null unless exactly 13 digits remain. */
export function normalizeCnic(input) {
  if (typeof input !== "string") return null;
  const digits = input.replace(/\D/g, "");
  return digits.length === 13 ? digits : null;
}

/** 13 digits -> "12345-1234567-1". */
export function formatCnic(digits) {
  if (!digits || digits.length !== 13) return "";
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

/** For lists and logs: "*****-***4567-1". Never show the full CNIC where it is not needed. */
export function maskCnic(digits) {
  if (!digits || digits.length !== 13) return "";
  return `*****-***${digits.slice(8, 12)}-${digits.slice(12)}`;
}
