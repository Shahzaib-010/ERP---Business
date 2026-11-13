// Customer import: the columns, the header names each column is recognised by, and how a
// spreadsheet row becomes the input of createCustomer(). Shared by the browser (matching
// and preview) and the server (which validates and saves).

export const IMPORT_MAX_ROWS = 1000;
export const IMPORT_CHUNK = 50; // rows saved per request, so each request stays short

/** Target fields in template order. `aliases` are compared after normalizeHeader(). */
export const CUSTOMER_IMPORT_FIELDS = [
  { key: "name", label: "Name", required: true, aliases: ["name", "customer", "customername", "fullname", "naam", "buyer"] },
  { key: "fatherOrHusbandName", label: "Father / husband name", aliases: ["father", "fathername", "fatherhusband", "fatherhusbandname", "fatherorhusbandname", "husband", "husbandname", "so", "wo", "do", "guardian", "walid"] },
  { key: "cnic", label: "CNIC", required: true, aliases: ["cnic", "cnicno", "cnicnumber", "nic", "idcard", "idcardno", "shanakhti", "shanakhticard", "nationalid"] },
  { key: "phone1", label: "Phone", aliases: ["phone", "phone1", "mobile", "mobile1", "mobileno", "mobilenumber", "contact", "contactno", "cell", "cellno", "phoneno", "phonenumber", "number"] },
  { key: "phone2", label: "Phone 2", aliases: ["phone2", "mobile2", "otherphone", "alternatephone", "secondphone", "contact2"] },
  { key: "phone3", label: "Phone 3", aliases: ["phone3", "mobile3", "contact3"] },
  { key: "whatsapp", label: "WhatsApp", aliases: ["whatsapp", "whatsappno", "whatsappnumber", "wa", "watsapp", "whatsap"] },
  { key: "caste", label: "Caste", aliases: ["caste", "tribe", "qoum", "qaum", "zaat"] },
  { key: "profession", label: "Profession", aliases: ["profession", "occupation", "job", "work", "kaam", "pesha"] },
  { key: "designation", label: "Designation", aliases: ["designation", "post", "rank", "title"] },
  { key: "homeAddress", label: "Home address", aliases: ["address", "homeaddress", "permanentaddress", "home", "residence", "pata"] },
  { key: "collectionAddress", label: "Collection address", aliases: ["collectionaddress", "installmentaddress", "recoveryaddress", "collection"] },
  { key: "businessAddress", label: "Business address", aliases: ["businessaddress", "officeaddress", "office", "shopaddress", "workaddress"] },
  { key: "notes", label: "Notes", aliases: ["notes", "note", "remarks", "remark", "comments", "comment"] },
];

export function normalizeHeader(h) {
  return String(h ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Best guess of which file column feeds each field: { fieldKey: columnIndex | null }. */
export function guessMapping(headers) {
  const normalized = headers.map(normalizeHeader);
  const used = new Set();
  const mapping = {};
  for (const f of CUSTOMER_IMPORT_FIELDS) {
    const idx = normalized.findIndex((h, i) => !used.has(i) && h && f.aliases.includes(h));
    mapping[f.key] = idx >= 0 ? idx : null;
    if (idx >= 0) used.add(idx);
  }
  return mapping;
}

/** A spreadsheet cell as text. Excel drops the leading 0 of phone numbers stored as numbers. */
export function cellText(value, fieldKey) {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  let s = String(value).trim();
  if (typeof value === "number" && (fieldKey?.startsWith("phone") || fieldKey === "whatsapp") &&/^3\d{9}$/.test(s)) s = `0${s}`;
  return s;
}

/** One file row -> the object the server receives (field keys, text values). */
export function rowToRecord(row, mapping) {
  const out = {};
  for (const f of CUSTOMER_IMPORT_FIELDS) {
    const idx = mapping[f.key];
    out[f.key] = idx == null ? "" : cellText(row[idx], f.key);
  }
  return out;
}

/** Template header row (also used for the downloadable template). */
export const CUSTOMER_TEMPLATE_HEADERS = CUSTOMER_IMPORT_FIELDS.map((f) => f.label);
export const CUSTOMER_TEMPLATE_EXAMPLE = [
  "Muhammad Asif",
  "Muhammad Yousaf",
  "31303-1234567-1",
  "0300-1234567",
  "",
  "",
  "Arain",
  "Shopkeeper",
  "",
  "Mohalla Islamabad, Rahim Yar Khan",
  "Same as home",
  "",
  "Imported from paper register",
];
