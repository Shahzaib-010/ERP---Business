// Cash book entry types and categories, shared by server and forms (Phase 5, D-014).
// The category lists are sensible defaults for a showroom; the owner can ask to change them.

export const ENTRY_TYPES = {
  expense: { label: "Expense", direction: "out" },
  other_income: { label: "Other income", direction: "in" },
  owner_investment: { label: "Owner investment", direction: "in" },
  owner_withdrawal: { label: "Owner withdrawal", direction: "out" },
};

export const EXPENSE_CATEGORIES = [
  { value: "rent", label: "Rent" },
  { value: "salaries", label: "Salaries & wages" },
  { value: "utilities", label: "Electricity & utilities" },
  { value: "transport", label: "Fuel & transport" },
  { value: "repairs", label: "Repairs & maintenance" },
  { value: "parts", label: "Parts & accessories" },
  { value: "registration", label: "Registration & documents" },
  { value: "marketing", label: "Marketing" },
  { value: "taxes", label: "Taxes & government fees" },
  { value: "office", label: "Office & tea" },
  { value: "other", label: "Other" },
];

export const INCOME_CATEGORIES = [
  { value: "commission", label: "Commission" },
  { value: "service", label: "Service & repairs" },
  { value: "documents", label: "Document & file fees" },
  { value: "other", label: "Other" },
];

/** Where cash book rows come from. Only "manual" rows are entered on the cash book itself. */
export const SOURCE_LABELS = {
  advance: "Advance",
  installment: "Installment payment",
  bike_cash_sale: "Bike sale (cash)",
  seller_payment: "Payment to seller",
  expense: "Expense",
  other_income: "Other income",
  owner_investment: "Owner investment",
  owner_withdrawal: "Owner withdrawal",
};

export function categoryLabel(type, category) {
  const list = type === "expense" ? EXPENSE_CATEGORIES : type === "other_income" ? INCOME_CATEGORIES : [];
  return list.find((c) => c.value === category)?.label ?? null;
}

/** Dashboard / cash book periods. All are calendar-based in Pakistan time. */
export const PERIODS = [
  { value: "month", label: "This month" },
  { value: "3m", label: "3 months" },
  { value: "12m", label: "12 months" },
  { value: "year", label: "This year" },
];
