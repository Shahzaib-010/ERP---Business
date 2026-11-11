"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BikeIcon } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { NAV_GROUPS } from "./nav-config";
import { NavUser } from "./nav-user";

export function isActivePath(pathname, href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** `allowed`: hrefs this person may open (computed on the server). */
export function AppSidebar({ allowed, user, business }) {
  const pathname = usePathname();
  const { isMobile, setOpenMobile } = useSidebar();
  const allowedSet = new Set(allowed);
  const groups = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => allowedSet.has(i.href)) })).filter(
    (g) => g.items.length > 0,
  );
  const closeOnMobile = () => isMobile && setOpenMobile(false);

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip={business.name}>
              <Link href="/dashboard" onClick={closeOnMobile}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
                  <BikeIcon className="size-4 text-brand dark:text-sidebar-primary-foreground" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{business.name}</span>
                  <span className="truncate text-xs text-muted-foreground">Showroom &amp; installments</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarMenu>
              {group.items.map((item) => {
                const active = isActivePath(pathname, item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                      className="relative data-[active=true]:before:absolute data-[active=true]:before:inset-y-1.5 data-[active=true]:before:left-0 data-[active=true]:before:w-[3px] data-[active=true]:before:rounded-full data-[active=true]:before:bg-brand data-[active=true]:before:shadow-[0_0_8px_var(--brand)]"
                    >
                      <Link href={item.href} onClick={closeOnMobile} aria-current={active ? "page" : undefined}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
