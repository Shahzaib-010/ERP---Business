import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AppBreadcrumbs } from "./breadcrumbs";
import { CommandMenu } from "./command-menu";
import { NotificationBell } from "./notification-bell";

export function SiteHeader({ allowed, can }) {
  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 rounded-t-xl border-b bg-background/80 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 data-[orientation=vertical]:h-4" />
      <div className="min-w-0 flex-1">
        <AppBreadcrumbs />
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <CommandMenu allowed={allowed} can={can} />
        <NotificationBell />
      </div>
    </header>
  );
}
