import Link from "next/link";
import { Suspense } from "react";
import {
  AlarmClockIcon,
  ArrowRightIcon,
  BanknoteIcon,
  BikeIcon,
  BookOpenIcon,
  CalendarIcon,
  FileTextIcon,
  HandCoinsIcon,
  LandmarkIcon,
  PackageIcon,
  ScaleIcon,
  ShoppingBagIcon,
  TrendingUpIcon,
  UserPlusIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { ActivityList } from "@/components/app/activity-list";
import { ChartCard } from "@/components/app/charts/chart-card";
import { AgingBreakdown, BreakdownBars, CashFlowChart, SalesChart } from "@/components/app/charts/finance-charts";
import { Stagger, StaggerItem } from "@/components/app/motion";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PlanStatusBadge } from "@/components/app/plan-ui";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { getDashboardOverview } from "@/server/services/dashboard";
import { getFinanceOverview } from "@/server/services/finance";
import { PERIODS } from "@/lib/cashbook";
import { formatNumber, formatPKR, formatRelative, initials } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { Kpi } from "./kpi";

export const metadata = { title: "Dashboard" };

export default function DashboardPage({ searchParams }) {
  return (
    <Suspense fallback={<PageSkeleton variant="cards" />}>
      <DashboardContent searchParams={searchParams} />
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
  new Intl.DateTimeFormat("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Karachi" }).format(new Date());

const COMPARE = { month: "vs last month", "3m": "vs previous 3 months", "12m": "vs previous 12 months", year: "vs last year" };

function PeriodTabs({ period }) {
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1" aria-label="Period">
      {PERIODS.map((p) => (
        <Link
          key={p.value}
          href={p.value === "month" ? "/dashboard" : `/dashboard?period=${p.value}`}
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

function SectionTitle({ children, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h2 className="text-sm font-semibold tracking-wide text-muted-foreground uppercase">{children}</h2>
      {action}
    </div>
  );
}

async function DashboardContent({ searchParams }) {
  const actor = await requireStaffPage();
  const sp = await searchParams;
  const period = PERIODS.some((p) => p.value === sp.period) ? sp.period : "month";
  const showMoney = can(actor, "dashboard.view");
  const [data, fin] = await Promise.all([getDashboardOverview(actor), showMoney ? getFinanceOverview(actor, period) : Promise.resolve(null)]);
  const firstName = actor.name.split(" ")[0];
  const inst = data.installments;
  const compareLabel = COMPARE[period];

  const trendTable = fin && {
    columns: [
      { key: "label", label: "Month" },
      { key: "cashIn", label: "Cash in", align: "right" },
      { key: "cashOut", label: "Cash out", align: "right" },
      { key: "net", label: "Net", align: "right" },
    ],
    rows: fin.trend.map((t) => ({ key: t.month, label: t.label, cashIn: formatPKR(t.cashIn), cashOut: formatPKR(t.cashOut), net: formatPKR(t.cashIn - t.cashOut) })),
  };
  const salesTable = fin && {
    columns: [
      { key: "label", label: "Month" },
      { key: "inst", label: "On installments", align: "right" },
      { key: "cash", label: "Cash sales", align: "right" },
      { key: "total", label: "Total", align: "right" },
    ],
    rows: fin.trend.map((t) => ({
      key: t.month,
      label: t.label,
      inst: formatPKR(t.salesInstallment),
      cash: formatPKR(t.salesCash),
      total: formatPKR(t.salesInstallment + t.salesCash),
    })),
  };
  const thisMonth = fin?.trend.at(-1);

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
            {can(actor, "transactions.view") && (
              <Button variant="outline" asChild>
                <Link href="/cashbook">
                  <BookOpenIcon /> Cash book
                </Link>
              </Button>
            )}
            {can(actor, "installments.create") && (
              <Button variant="outline" asChild>
                <Link href="/plans/new">
                  <FileTextIcon /> New plan
                </Link>
              </Button>
            )}
            {can(actor, "customers.create") && (
              <Button asChild>
                <Link href="/customers/new">
                  <UserPlusIcon /> Add customer
                </Link>
              </Button>
            )}
          </>
        }
      />

      {fin && (
        <>
          {/* Performance in the selected period */}
          <section className="space-y-3">
            <SectionTitle action={<PeriodTabs period={period} />}>Performance · {fin.range.label}</SectionTitle>
            <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StaggerItem>
                <Kpi label="Cash received" value={fin.kpis.cashIn.value} previous={fin.kpis.cashIn.previous} icon={BanknoteIcon} tone="success" compareLabel={compareLabel} href="/cashbook" />
              </StaggerItem>
              <StaggerItem>
                <Kpi
                  label="Cash paid out"
                  value={fin.kpis.cashOut.value}
                  previous={fin.kpis.cashOut.previous}
                  icon={HandCoinsIcon}
                  tone="warning"
                  goodWhen={null}
                  compareLabel={compareLabel}
                  href="/cashbook?direction=out"
                />
              </StaggerItem>
              <StaggerItem>
                <Kpi label="Net cash flow" value={fin.kpis.net.value} previous={fin.kpis.net.previous} icon={ScaleIcon} tone={fin.kpis.net.value >= 0 ? "primary" : "danger"} compareLabel={compareLabel} />
              </StaggerItem>
              <StaggerItem>
                <Kpi
                  label="Sales"
                  value={fin.kpis.sales.value}
                  previous={fin.kpis.sales.previous}
                  icon={TrendingUpIcon}
                  compareLabel={compareLabel}
                  hint={`${formatNumber(fin.kpis.sales.count)} ${fin.kpis.sales.count === 1 ? "sale" : "sales"} · ${formatNumber(fin.kpis.bikesSold)} ${fin.kpis.bikesSold === 1 ? "bike" : "bikes"}`}
                />
              </StaggerItem>
            </Stagger>
          </section>

          {/* Where the business stands today */}
          <section className="space-y-3">
            <SectionTitle>Position today</SectionTitle>
            <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StaggerItem>
                <Kpi accent label="Cash in hand" value={fin.position.cashInHand} icon={LandmarkIcon} hint="All cash in minus all cash out recorded so far" href="/cashbook" />
              </StaggerItem>
              <StaggerItem>
                <Kpi
                  label="Receivables"
                  value={fin.position.receivables}
                  icon={WalletIcon}
                  tone="primary"
                  href="/plans?status=active"
                  hint={
                    fin.position.overdue
                      ? `${formatPKR(fin.position.overdue)} overdue · ${formatNumber(fin.position.activePlans)} active plans`
                      : `${formatNumber(fin.position.activePlans)} active plans, none late`
                  }
                />
              </StaggerItem>
              <StaggerItem>
                <Kpi
                  label="Owed to sellers"
                  value={fin.position.payables}
                  icon={PackageIcon}
                  tone={fin.position.payables ? "warning" : "muted"}
                  href="/bikes?status=owed"
                  hint={fin.position.payableBikes ? `On ${fin.position.payableBikes} ${fin.position.payableBikes === 1 ? "bike" : "bikes"}` : "All sellers paid"}
                />
              </StaggerItem>
              <StaggerItem>
                <Kpi
                  label="Stock value"
                  value={fin.position.stockValue}
                  icon={BikeIcon}
                  tone="muted"
                  href="/bikes"
                  hint={`${formatNumber(fin.position.stockCount)} ${fin.position.stockCount === 1 ? "bike" : "bikes"} in stock, at purchase price`}
                />
              </StaggerItem>
            </Stagger>
          </section>

          {/* Trends */}
          <div className="grid gap-6 xl:grid-cols-3">
            <ChartCard
              className="xl:col-span-2"
              title="Cash flow"
              description={thisMonth ? `Last 12 months. This month: ${formatPKR(thisMonth.cashIn)} in, ${formatPKR(thisMonth.cashOut)} out.` : "Last 12 months."}
              table={trendTable}
            >
              <CashFlowChart data={fin.trend} />
            </ChartCard>
            <ChartCard title="Where money came from" description={fin.range.label}>
              <BreakdownBars items={fin.moneyIn} tone="in" empty="No cash received in this period." />
            </ChartCard>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <ChartCard
              className="xl:col-span-2"
              title="Sales"
              description={
                thisMonth
                  ? `Last 12 months, counted when the sale is made. This month: ${formatPKR(thisMonth.salesInstallment + thisMonth.salesCash)}.`
                  : "Last 12 months."
              }
              table={salesTable}
            >
              <SalesChart data={fin.trend} />
            </ChartCard>
            <ChartCard
              title="Receivables health"
              description={`${formatPKR(fin.position.receivables)} owed on ${formatNumber(fin.position.activePlans)} active plans`}
              action={
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/plans?status=late">
                    Late <ArrowRightIcon />
                  </Link>
                </Button>
              }
            >
              <AgingBreakdown buckets={fin.aging} total={fin.position.receivables} />
            </ChartCard>
          </div>
        </>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        {fin && (
          <ChartCard title="Where money went" description={fin.range.label}>
            <BreakdownBars items={fin.moneyOut} tone="out" empty="No cash paid out in this period." />
          </ChartCard>
        )}
        {inst && (
          <Card className={fin ? "xl:col-span-2" : "xl:col-span-3"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlarmClockIcon className="size-4 text-destructive" /> Needs attention
              </CardTitle>
              <CardDescription>{inst.lateCount ? `${inst.lateCount} late ${inst.lateCount === 1 ? "plan" : "plans"}, ${formatPKR(inst.lateAmount)} overdue.` : "No plan is late."}</CardDescription>
              <CardAction>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/plans?status=late">
                    All late plans <ArrowRightIcon />
                  </Link>
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent>
              {inst.mostLate.length === 0 ? (
                <Empty className="border py-8">
                  <EmptyHeader>
                    <EmptyTitle className="text-sm">Everyone is up to date</EmptyTitle>
                    <EmptyDescription>Late plans will show here, furthest behind first.</EmptyDescription>
                  </EmptyHeader>
                </Empty>
              ) : (
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
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {data.customers && (
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UsersIcon className="size-4 text-muted-foreground" /> Recent customers
              </CardTitle>
              <CardDescription>
                {formatNumber(data.customers.total)} customers · {formatNumber(data.customers.addedThisMonth)} new this month
              </CardDescription>
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
                  {can(actor, "customers.create") && (
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
                      <Link href={`/customers/${c.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60">
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
              <CardTitle className="flex items-center gap-2 text-base">
                <ShoppingBagIcon className="size-4 text-muted-foreground" /> Recent activity
              </CardTitle>
              <CardDescription>What staff have done lately.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityList events={data.activity} showEntity />
            </CardContent>
          </Card>
        ) : (
          !data.customers &&
          !fin && (
            <Card className="lg:col-span-5">
              <CardHeader>
                <CardTitle>Welcome</CardTitle>
                <CardDescription>Your account does not have access to any modules yet. Ask the Superadmin to grant the permissions you need.</CardDescription>
              </CardHeader>
            </Card>
          )
        )}
      </div>
    </PageBody>
  );
}
