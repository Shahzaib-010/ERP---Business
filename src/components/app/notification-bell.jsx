"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlarmClockIcon, BellIcon, CalendarClockIcon, CheckCheckIcon, CircleAlertIcon, HandCoinsIcon, InfoIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { markNotificationsReadAction } from "@/app/(staff)/notifications/actions";
import { auditActionLabel } from "@/lib/audit-labels";
import { formatRelative } from "@/lib/format";
import { ACTIVITY_EVENTS, activityHref } from "@/lib/notifications";
import { cn } from "@/lib/utils";

// Header bell: "needs attention" alerts and recent team activity. Refreshes every few
// minutes while the tab is visible (not constantly, to keep hosting usage low) and on each
// page change. New team activity also shows a toast. Opening the bell marks it as read.

const POLL_MS = 3 * 60 * 1000;

const ALERT_STYLE = {
  danger: { icon: AlarmClockIcon, tile: "bg-destructive/10 text-destructive" },
  attention: { icon: CalendarClockIcon, tile: "bg-warning/18 text-warning-foreground dark:text-warning" },
  info: { icon: InfoIcon, tile: "bg-primary/8 text-primary dark:bg-primary/15" },
};
const ALERT_ICON = { sellers: HandCoinsIcon };

/** "Ali Raza · #1318" — who did it, and on which record. */
function eventSubtitle(e) {
  return `${e.actorName}${e.entityName ? ` · ${e.entityName}` : ""}`;
}

export function NotificationBell() {
  const pathname = usePathname();
  const [data, setData] = useState(null);
  const [open, setOpen] = useState(false);
  const known = useRef(null); // ids already seen in this tab, so only new ones toast

  const lastLoad = useRef(0);
  const load = useCallback(async () => {
    lastLoad.current = Date.now();
    // Plain fetch, not a Server Action: a background refresh must never delay a link click.
    let res;
    try {
      const r = await fetch("/api/notifications", { cache: "no-store" });
      res = await r.json();
    } catch {
      return;
    }
    if (!res?.ok) return;
    const next = res.data;
    if (known.current) {
      const fresh = next.activity.filter((e) => e.unread && !known.current.has(e.id));
      fresh.slice(0, 3).forEach((e) => {
        const show = ACTIVITY_EVENTS[e.action] === "alert" ? toast.warning : toast.info;
        show(auditActionLabel(e.action), { description: eventSubtitle(e) });
      });
      if (fresh.length > 3) toast.info(`${fresh.length - 3} more updates`, { description: "Open the bell to see them." });
    }
    known.current = new Set(next.activity.map((e) => e.id));
    setData(next);
  }, []);

  // First load, then every few minutes while the tab is visible.
  useEffect(() => {
    const first = setTimeout(load, 0); // after paint, not during the effect
    const timer = setInterval(() => document.visibilityState === "visible" && load(), POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  // Page changes refresh it too (keeps the badge honest after saving something), at most
  // every 20 seconds, and only once the new page has had a moment to load.
  const firstPath = useRef(true);
  useEffect(() => {
    if (firstPath.current) {
      firstPath.current = false;
      return;
    }
    if (Date.now() - lastLoad.current < 20_000) return;
    const t = setTimeout(load, 1500);
    return () => clearTimeout(t);
  }, [pathname, load]);

  const markRead = async () => {
    await markNotificationsReadAction();
    setData((d) => (d ? { ...d, unreadActivity: 0, badge: d.badge - d.unreadActivity, activity: d.activity.map((a) => ({ ...a, unread: false })) } : d));
  };

  const onOpenChange = (o) => {
    setOpen(o);
    if (o) load();
    // Closing after looking marks the activity as read (the dots stay visible while open).
    if (!o && data?.unreadActivity) markRead();
  };

  const badge = data?.badge ?? 0;
  const alerts = data?.alerts ?? [];
  const activity = data?.activity ?? [];

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-8 shrink-0" aria-label={badge ? `Notifications, ${badge} new` : "Notifications"}>
          <BellIcon className="size-4" />
          {badge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] leading-none font-semibold text-white tabular-nums ring-2 ring-background">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(380px,calc(100vw-1.5rem))] gap-0 overflow-hidden p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <p className="text-sm font-semibold">Notifications</p>
          {data?.unreadActivity > 0 && (
            <Button variant="ghost" size="xs" className="text-muted-foreground" onClick={markRead}>
              <CheckCheckIcon /> Mark all read
            </Button>
          )}
        </div>

        <div className="max-h-[min(70vh,520px)] overflow-y-auto">
          {!data ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Loading…</p>
          ) : (
            <>
              {alerts.length > 0 && (
                <section className="border-b p-2">
                  <p className="px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Needs attention</p>
                  {alerts.map((a) => {
                    const style = ALERT_STYLE[a.tone] ?? ALERT_STYLE.info;
                    const Icon = ALERT_ICON[a.key] ?? style.icon;
                    return (
                      <Link key={a.key} href={a.href} onClick={() => setOpen(false)} className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-muted/70">
                        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-md", style.tile)}>
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{a.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">{a.body}</span>
                        </span>
                      </Link>
                    );
                  })}
                </section>
              )}

              {data.canActivity && (
                <section className="p-2">
                  <p className="px-2 pt-1 pb-1.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Team activity</p>
                  {activity.length === 0 ? (
                    <p className="px-2 py-4 text-sm text-muted-foreground">Nothing from other staff in the last 14 days.</p>
                  ) : (
                    activity.map((e) => {
                      const href = activityHref(e);
                      const loud = ACTIVITY_EVENTS[e.action] === "alert";
                      const body = (
                        <>
                          <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", e.unread ? (loud ? "bg-destructive" : "bg-primary") : "bg-transparent")} aria-hidden="true" />
                          <span className="min-w-0 flex-1">
                            <span className={cn("block text-sm", e.unread && "font-medium")}>
                              {loud && <CircleAlertIcon className="mr-1 inline size-3.5 -translate-y-px text-destructive" />}
                              {auditActionLabel(e.action)}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">{eventSubtitle(e)}</span>
                            {e.reason && <span className="block truncate text-xs text-muted-foreground italic">“{e.reason}”</span>}
                          </span>
                          <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">{formatRelative(e.createdAt)}</span>
                        </>
                      );
                      return href ? (
                        <Link key={e.id} href={href} onClick={() => setOpen(false)} className="flex items-start gap-2.5 rounded-lg px-2 py-2 transition-colors hover:bg-muted/70">
                          {body}
                        </Link>
                      ) : (
                        <div key={e.id} className="flex items-start gap-2.5 rounded-lg px-2 py-2">
                          {body}
                        </div>
                      );
                    })
                  )}
                </section>
              )}

              {alerts.length === 0 && !data.canActivity && (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">You are all caught up.</p>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
