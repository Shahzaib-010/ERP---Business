import Link from "next/link";
import { Suspense } from "react";
import {
  AlarmClockIcon,
  ArrowRightIcon,
  BanknoteIcon,
  FileTextIcon,
  WalletIcon,
  CalendarIcon,
  KeyRoundIcon,
  SearchIcon,
  ShieldCheckIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ActivityList } from "@/components/app/activity-list";
import { Stagger, StaggerItem } from "@/components/app/motion";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PageSkeleton } from "@/components/app/skeletons";
import { StatCard } from "@/components/app/stat-card";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { getDashboardOverview } from "@/server/services/dashboard";
import { formatNumber, formatPKR, formatRelative, initials } from "@/lib/format";
import { PlanStatusBadge } from "@/components/app/plan-ui";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="cards" />}>
      <DashboardContent />
    </Suspense>
  );
}

function greeting(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Karachi" }).format(now));
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const todayLabel = () =>
  new Intl.DateTimeFormat("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" }).format(
    new Date(),
  );

async function DashboardContent() {
  const actor = await requireStaffPage();
  const data = await getDashboardOverview(actor);
  const firstName = actor.name.split(" ")[0];
  const canCreate = can(actor, "customers.create");

  const stats = [];
  const inst = data.installments;
  if (inst) {
    stats.push(
      { key: "outstanding", label: "Outstanding balance", value: formatPKR(inst.outstanding), icon: WalletIcon, href: "/plans?status=active", hint: `${formatNumber(inst.activeCount)} active ${inst.activeCount === 1 ? "plan" : "plans"}` },
      { key: "collected", label: "Collected this month", value: formatPKR(inst.collectedThisMonth), icon: BanknoteIcon, tone: "success", hint: `${formatNumber(inst.paymentsThisMonth)} ${inst.paymentsThisMonth === 1 ? "payment" : "payments"}` },
      { key: "late", label: "Late plans", value: formatNumber(inst.lateCount), icon: AlarmClockIcon, tone: inst.lateCount ? "warning" : "muted", href: "/plans?status=late", hint: inst.lateCount ? `${formatPKR(inst.lateAmount)} overdue` : "Everyone is up to date" },
    );
    if (data.customers) {
      stats.push({ key: "total", label: "Customers", value: formatNumber(data.customers.total), icon: UsersIcon, href: "/customers", hint: `+${formatNumber(data.customers.addedThisMonth)} this month` });
    }
  } else if (data.customers) {
    const { total, addedThisMonth, addedLastMonth, portalEnabled } = data.customers;
    const delta = addedThisMonth - addedLastMonth;
    stats.push(
      { key: "total", label: "Total customers", value: formatNumber(total), icon: UsersIcon, href: "/customers", hint: "All registered customers" },
      {
        key: "month",
        label: "New this month",
        value: formatNumber(addedThisMonth),
        icon: UserPlusIcon,
        tone: "success",
        trend: addedLastMonth || addedThisMonth ? { value: `${delta >= 0 ? "+" : ""}${delta}`, up: delta >= 0, label: "vs last month" } : null,
        hint: "No new customers yet",
      },
      { key: "portal", label: "Portal logins on", value: formatNumber(portalEnabled), icon: KeyRoundIcon, tone: "warning", hint: "Customers who can sign in" },
    );
  }
  if (data.staff && !inst) {
    stats.push({
      key: "staff",
      label: "Active staff",
      value: formatNumber(data.staff.active),
      icon: ShieldCheckIcon,
      tone: "muted",
      href: "/users",
      hint: data.staff.disabled ? `${data.staff.disabled} disabled` : "All accounts active",
    });
  }

  return (
    <PageBody>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={
          <span className="inline-flex items-center gap-1.5">
            <CalendarIcon className="size-3.5" />
            {todayLabel()}
          </span>
        }
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/search">
                <SearchIcon /> Search
              </Link>
            </Button>
            {inst && can(actor, "installments.create") && (
              <Button variant="outline" asChild>
                <Link href="/plans/new">
                  <FileTextIcon /> New plan
                </Link>
              </Button>
            )}
            {canCreate && (
              <Button asChild>
                <Link href="/customers/new">
                  <UserPlusIcon /> Add customer
                </Link>
              </Button>
            )}
          </>
        }
      />

      {stats.length > 0 && (
        <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ key, ...s }) => (
            <StaggerItem key={key}>
              <StatCard {...s} />
            </StaggerItem>
          ))}
        </Stagger>
      )}

      {inst && inst.mostLate.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Needs attention</CardTitle>
            <CardDescription>The plans that are furthest behind.</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/plans?status=late">
                  All late plans <ArrowRightIcon />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <ul className="-mx-2 divide-y">
              {inst.mostLate.map((p) => (
                <li key={p.id}>
                  <Link href={`/plans/${p.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60">
                    <span className="w-16 shrink-0 font-mono text-sm font-semibold">#{p.accountNumber}</span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.customer?.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{p.item.description}</p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-sm font-medium tabular-nums text-destructive">{formatPKR(p.overdue.amount)}</p>
                      <p className="text-xs text-muted-foreground">overdue</p>
                    </div>
                    <PlanStatusBadge status={p.status} overdue={p.overdue} />
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        {data.customers && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Recent customers</CardTitle>
              <CardDescription>The latest people added to the register.</CardDescription>
              <CardAction>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/customers">
                    View all <ArrowRightIcon />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {data.customers.recent.length === 0 ? (
                <Empty className="border py-10">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <UsersIcon />
                    </EmptyMedia>
                    <EmptyTitle>No customers yet</EmptyTitle>
                    <EmptyDescription>Add your first customer to get started.</EmptyDescription>
                  </EmptyHeader>
                  {canCreate && (
                    <EmptyContent>
                      <Button asChild size="sm">
                        <Link href="/customers/new">
                          <UserPlusIcon /> Add customer
                        </Link>
                      </Button>
                    </EmptyContent>
                  )}
                </Empty>
              ) : (
                <ul className="-mx-2 divide-y">
                  {data.customers.recent.map((c) => (
                    <li key={c.id}>
                      <Link
                        href={`/customers/${c.id}`}
                        className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60"
                      >
                        <Avatar className="size-9">
                          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(c.name)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{c.name}</p>
                          <p className="truncate font-mono text-xs text-muted-foreground">
                            {c.cnicMasked}
                            {c.phones[0] && ` · ${formatPhone(c.phones[0])}`}
                          </p>
                        </div>
                        <div className="hidden text-right sm:block">
                          {c.portalEnabled && (
                            <Badge variant="secondary" className="mb-1">
                              Portal
                            </Badge>
                          )}
                          <p className="text-xs text-muted-foreground">{formatRelative(c.createdAt)}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        {data.activity ? (
          <Card className={data.customers ? "lg:col-span-2" : "lg:col-span-5"}>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Changes made by staff.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityList events={data.activity} showEntity />
            </CardContent>
          </Card>
        ) : (
          !data.customers && (
            <Card className="lg:col-span-5">
              <CardHeader>
                <CardTitle>Welcome</CardTitle>
                <CardDescription>
                  Your account does not have access to any modules yet. Ask the Superadmin to grant the permissions you need.
                </CardDescription>
              </CardHeader>
            </Card>
          )
        )}
      </div>
    </PageBody>
  );
}
