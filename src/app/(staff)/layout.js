import { Suspense } from "react";
import { cookies } from "next/headers";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/app-sidebar";
import { BreadcrumbProvider } from "@/components/app/breadcrumbs";
import { SiteHeader } from "@/components/app/site-header";
import { ShellSkeleton } from "@/components/app/skeletons";
import { NAV_GROUPS } from "@/components/app/nav-config";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { ROLE_LABELS } from "@/lib/permissions-catalog";
import { BUSINESS } from "@/lib/business";

// Staff app shell: collapsible sidebar on the left, page on the right.
// The shell checks the session for navigation only; every page and action checks it again.
export default function StaffLayout({ children }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <StaffShell>{children}</StaffShell>
    </Suspense>
  );
}

async function StaffShell({ children }) {
  const actor = await requireStaffPage();
  const defaultOpen = (await cookies()).get("sidebar_state")?.value !== "false";

  const allowed = NAV_GROUPS.flatMap((g) => g.items)
    .filter((item) => !item.permission || can(actor, item.permission))
    .map((item) => item.href);
  const user = { name: actor.name, username: actor.username, roleLabel: ROLE_LABELS[actor.role] };

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <BreadcrumbProvider>
        <AppSidebar allowed={allowed} user={user} business={{ name: BUSINESS.name }} />
        <SidebarInset className="min-w-0">
          <SiteHeader allowed={allowed} canCreateCustomer={can(actor, "customers.create")} />
          <div className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </div>
        </SidebarInset>
      </BreadcrumbProvider>
    </SidebarProvider>
  );
}
