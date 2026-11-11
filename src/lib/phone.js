// Phone display helper shared by server and client. Phones are stored as digits only (D-007).

/** "03001234567" -> "0300-1234567". Other lengths are shown as stored. */
export function formatPhone(digits) {
  if (typeof digits !== "string") return "";
  if (/^03\d{9}$/.test(digits)) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return digits;
}
