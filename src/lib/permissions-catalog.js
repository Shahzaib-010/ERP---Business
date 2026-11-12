// The list of staff permissions. Shared with the UI so the Superadmin can tick them.
// Enforcement happens only on the server (src/server/permissions).
//
// Keys are "<module>.<action>". Add new ones here when a module is built.

export const ROLES = /** @type {const} */ (["superadmin", "admin", "user"]);

export const ROLE_LABELS = {
  superadmin: "Superadmin",
  admin: "Admin",
  user: "User",
};

/** Permissions that can be granted to the User role, grouped for the settings screen. */
export const PERMISSION_GROUPS = [
  {
    module: "customers",
    label: "Customers",
    actions: [
      { key: "customers.view", label: "View customers" },
      { key: "customers.create", label: "Add customers" },
      { key: "customers.edit", label: "Edit customers" },
    ],
  },
  {
    module: "bikes",
    label: "Bikes (showroom)",
    actions: [
      { key: "bikes.view", label: "View bikes" },
      { key: "bikes.create", label: "Add bike purchases and sales" },
      { key: "bikes.edit", label: "Edit bikes" },
    ],
  },
  {
    module: "installments",
    label: "Installment plans",
    actions: [
      { key: "installments.view", label: "View plans" },
      { key: "installments.create", label: "Create plans" },
      { key: "installments.edit", label: "Edit plans" },
    ],
  },
  {
    module: "payments",
    label: "Payments",
    actions: [
      { key: "payments.create", label: "Record payments" },
      { key: "payments.edit", label: "Correct or void payments" },
    ],
  },
  {
    module: "transactions",
    label: "Cash book (expenses, income, owner)",
    actions: [
      { key: "transactions.view", label: "View transactions" },
      { key: "transactions.create", label: "Add transactions" },
      { key: "transactions.edit", label: "Correct or void transactions" },
    ],
  },
  {
    module: "receipts",
    label: "Receipts",
    actions: [
      { key: "receipts.view", label: "View and print receipts" },
    ],
  },
  {
    module: "documents",
    label: "Documents",
    actions: [
      { key: "documents.view", label: "View private documents" },
      { key: "documents.upload", label: "Upload documents" },
      { key: "documents.remove", label: "Remove, restore and permanently erase documents", optIn: true },
    ],
  },
  {
    module: "dashboard",
    label: "Dashboard",
    actions: [
      { key: "dashboard.view", label: "View dashboard figures" },
    ],
  },
];

export const GRANTABLE_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.actions.map((a) => a.key));

/**
 * Opt-in permissions: grantable, but no role gets them by default. The Superadmin always has
 * them and can tick them on an individual Admin or User account (D-017: removing documents
 * is Superadmin-only for now, grantable later).
 */
export const OPT_IN_PERMISSIONS = PERMISSION_GROUPS.flatMap((g) => g.actions.filter((a) => a.optIn).map((a) => a.key));

/** Only a Superadmin ever has these. They cannot be granted. */
/** "installments.discount": close a balance with a settlement discount (D-008). */
export const SUPERADMIN_ONLY_PERMISSIONS = ["users.manage", "settings.manage", "audit.viewAll", "installments.discount"];

/** Admin has every grantable permission except the opt-in ones, plus the operational audit view. */
export const ADMIN_PERMISSIONS = [...GRANTABLE_PERMISSIONS.filter((p) => !OPT_IN_PERMISSIONS.includes(p)), "audit.view"];
