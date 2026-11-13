// Phone display helper shared by server and client. Phones are stored as digits only (D-007).

/**
 * WhatsApp chat link for a stored number. Pakistani numbers ("03001234567") become the
 * international form wa.me expects ("923001234567"); other numbers are used as stored.
 */
export function whatsappUrl(digits) {
  if (typeof digits !== "string" || !digits) return "";
  const intl = /^03\d{9}$/.test(digits) ? `92${digits.slice(1)}` : digits.replace(/^00/, "");
  return `https://wa.me/${intl}`;
}

/** "03001234567" -> "0300-1234567". Other lengths are shown as stored. */
export function formatPhone(digits) {
  if (typeof digits !== "string") return "";
  if (/^03\d{9}$/.test(digits)) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  return digits;
}
