import {
  BikeIcon,
  BookOpenIcon,
  ClipboardListIcon,
  FileTextIcon,
  LayoutDashboardIcon,
  SearchIcon,
  ShieldCheckIcon,
  UserCogIcon,
  UsersIcon,
} from "lucide-react";

// Sidebar and command-menu entries. Which entries a person sees is decided on the server
// (the staff layout passes the allowed hrefs); this file only describes how they look.
// Add an entry when a module's screens are built.
export const NAV_GROUPS = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
      { href: "/search", label: "Search", icon: SearchIcon },
    ],
  },
  {
    label: "Showroom",
    items: [{ href: "/bikes", label: "Bikes", icon: BikeIcon, permission: "bikes.view" }],
  },
  {
    label: "Sales",
    items: [
      { href: "/customers", label: "Customers", icon: UsersIcon, permission: "customers.view" },
      { href: "/plans", label: "Installment plans", icon: FileTextIcon, permission: "installments.view" },
    ],
  },
  {
    label: "Money",
    items: [
      { href: "/cashbook", label: "Cash book", icon: BookOpenIcon, permission: "transactions.view" },
      { href: "/reports/daily", label: "Daily report", icon: ClipboardListIcon, permission: "transactions.view" },
    ],
  },
  {
    label: "Administration",
    items: [{ href: "/users", label: "Staff accounts", icon: ShieldCheckIcon, permission: "users.manage" }],
  },
];

export const ACCOUNT_ITEM = { href: "/account", label: "My account", icon: UserCogIcon };

/** Breadcrumb labels for fixed path segments. Record ids get their label from the page. */
export const SEGMENT_LABELS = {
  dashboard: "Dashboard",
  customers: "Customers",
  plans: "Installment plans",
  bikes: "Bikes",
  cashbook: "Cash book",
  reports: "Reports",
  daily: "Daily report",
  import: "Import",
  installments: "Installments",
  showroom: "Showroom",
  users: "Staff accounts",
  account: "My account",
  search: "Search",
  new: "New",
  edit: "Edit",
  "no-access": "No access",
};
