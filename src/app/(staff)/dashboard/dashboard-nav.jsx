import Link from "next/link";
import { BikeIcon, FileTextIcon, LayoutDashboardIcon } from "lucide-react";
import { PERIODS } from "@/lib/cashbook";
import { cn } from "@/lib/utils";

/** Overview | Installments | Showroom. Only tabs the person may open are shown. */
export function DashboardTabs({ current, show }) {
  const tabs = [
    { key: "overview", href: "/dashboard", label: "Overview", icon: LayoutDashboardIcon, visible: true },
    { key: "installments", href: "/dashboard/installments", label: "Installments", icon: FileTextIcon, visible: show.installments },
    { key: "showroom", href: "/dashboard/showroom", label: "Showroom", icon: BikeIcon, visible: show.showroom },
  ].filter((t) => t.visible);
  if (tabs.length < 2) return null;
  return (
    <nav className="-mb-px flex gap-6 overflow-x-auto border-b" aria-label="Dashboards">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={t.href}
          aria-current={current === t.key ? "page" : undefined}
          className={cn(
            "relative flex items-center gap-2 pb-3 text-sm whitespace-nowrap transition-colors",
            current === t.key
              ? "font-medium text-foreground after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <t.icon className="size-4" /> {t.label}
        </Link>
      ))}
    </nav>
  );
}

/** This month | 3 months | 12 months | This year, as links on the given page. */
export function PeriodTabs({ period, basePath }) {
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1" aria-label="Period">
      {PERIODS.map((p) => (
        <Link
          key={p.value}
          href={p.value === "month" ? basePath : `${basePath}?period=${p.value}`}
          scroll={false}
          aria-current={period === p.value ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1 text-sm whitespace-nowrap transition-colors",
            period === p.value ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}

export const COMPARE = { month: "vs last month", "3m": "vs previous 3 months", "12m": "vs previous 12 months", year: "vs last year" };

export function readPeriod(sp) {
  return PERIODS.some((p) => p.value === sp?.period) ? sp.period : "month";
}
