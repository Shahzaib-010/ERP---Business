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
  HistoryIcon,
  TrendingUpIcon,
  UserPlusIcon,
  UsersIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ActivityList } from "@/components/app/activity-list";
import { ChartCard } from "@/components/app/charts/chart-card";
import { AreaTrend, BreakdownBars, CashFlowChart, SalesChart } from "@/components/app/charts/finance-charts";
import { CountUp } from "@/components/app/count-up";
import { Stagger, StaggerItem } from "@/components/app/motion";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PlanStatusBadge } from "@/components/app/plan-ui";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { getDashboardOverview } from "@/server/services/dashboard";
import { getFinanceOverview } from "@/server/services/finance";
import { formatNumber, formatPKR } from "@/lib/format";
import { COMPARE, DashboardTabs, PeriodTabs, readPeriod } from "./dashboard-nav";
import { DeltaChip, Figure, SparkKpi } from "./kpi";

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

function BusinessCard({ icon: Icon, title, href, figures, note }) {
  return (
    <Link href={href} className="group block rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      <Card className="h-full gap-4 transition-shadow group-hover:shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Icon className="size-4 text-brand dark:text-primary-foreground" />
            </span>
            {title}
          </CardTitle>
          <CardAction>
            <span className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors group-hover:text-foreground">
              Open <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </CardAction>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-4">
          {figures.map((f) => (
            <div key={f.label}>
              <p className="text-xs text-muted-foreground">{f.label}</p>
              <p className={`mt-0.5 font-semibold tabular-nums ${f.tone ?? ""}`}>{f.value}</p>
            </div>
          ))}
        </CardContent>
        {note && <p className="-mt-1 px-6 text-xs text-muted-foreground">{note}</p>}
      </Card>
    </Link>
  );
}

async function DashboardContent({ searchParams }) {
  const actor = await requireStaffPage();
  const period = readPeriod(await searchParams);
  const showMoney = can(actor, "dashboard.view");
  const [data, fin] = await Promise.all([getDashboardOverview(actor), showMoney ? getFinanceOverview(actor, period) : Promise.resolve(null)]);
  const inst = data.installments;
  const compareLabel = COMPARE[period];
  const show = { installments: can(actor, "installments.view"), showroom: can(actor, "bikes.view") };
  const trend = fin?.trend.map((t) => ({ ...t, salesTotal: t.salesCash + t.salesInstallment })) ?? [];
  const thisMonth = trend.at(-1);
  const owedToYou = fin ? fin.position.receivables : 0;
  const youOwe = fin ? fin.position.payables : 0;

  const trendTable = fin && {
    columns: [
      { key: "label", label: "Month" },
      { key: "cashIn", label: "Cash in", align: "right" },
      { key: "cashOut", label: "Cash out", align: "right" },
      { key: "position", label: "Cash in hand", align: "right" },
    ],
    rows: trend.map((t) => ({ key: t.month, label: t.label, cashIn: formatPKR(t.cashIn), cashOut: formatPKR(t.cashOut), position: formatPKR(t.cashPosition) })),
  };
  const salesTable = fin && {
    columns: [
      { key: "label", label: "Month" },
      { key: "inst", label: "On installments", align: "right" },
      { key: "cash", label: "Cash sales", align: "right" },
      { key: "total", label: "Total", align: "right" },
    ],
    rows: trend.map((t) => ({ key: t.month, label: t.label, inst: formatPKR(t.salesInstallment), cash: formatPKR(t.salesCash), total: formatPKR(t.salesTotal) })),
  };

  return (
    <PageBody>
      <PageHeader
        title={`${greeting()}, ${actor.name.split(" ")[0]}`}
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

      <DashboardTabs current="overview" show={show} />

      {fin && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Showing <span className="font-medium text-foreground">{fin.range.label.toLowerCase()}</span>, compared with the period before.
            </p>
            <PeriodTabs period={period} basePath="/dashboard" />
          </div>

          {/* Hero: cash position + money owed */}
          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="relative gap-0 overflow-hidden py-0 xl:col-span-2">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-brand shadow-[0_0_12px_var(--brand)]" />
              <div className="flex flex-1 flex-col gap-5 p-6">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Cash in hand</p>
                  <p className={`mt-1 text-4xl font-semibold tracking-tight whitespace-nowrap tabular-nums sm:text-5xl ${fin.position.cashInHand < 0 ? "text-destructive" : ""}`}>
                    <CountUp value={fin.position.cashInHand} prefix="Rs " />
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Everything received minus everything paid, as recorded.</p>
                </div>
                <div className="grid grid-cols-3 gap-4 border-t pt-4 sm:gap-6">
                  <Figure label="Received" value={fin.kpis.cashIn.value} previous={fin.kpis.cashIn.previous} />
                  <Figure label="Paid out" value={fin.kpis.cashOut.value} previous={fin.kpis.cashOut.previous} goodWhen={null} />
                  <Figure label="Net" value={fin.kpis.net.value} previous={fin.kpis.net.previous} />
                </div>
              </div>
              <div className="border-t px-4 pt-4 pb-2">
                <p className="mb-1 px-2 text-xs font-medium text-muted-foreground">Cash in hand at the end of each month</p>
                <AreaTrend data={trend} dataKey="cashPosition" label="Cash in hand" height="h-44" />
              </div>
            </Card>

            <Card className="gap-5">
              <CardHeader>
                <CardTitle className="text-base">Money owed</CardTitle>
                <CardDescription>Today, across both businesses.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm text-muted-foreground">Customers owe you</p>
                    <Link href="/plans?status=active" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                      {formatNumber(fin.position.activePlans)} plans
                    </Link>
                  </div>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    <CountUp value={owedToYou} prefix="Rs " />
                  </p>
                  {fin.position.overdue > 0 && (
                    <Link href="/plans?status=late" className="mt-1 inline-flex items-center gap-1 rounded-md bg-destructive/10 px-1.5 py-0.5 text-xs font-medium text-destructive">
                      <AlarmClockIcon className="size-3" /> {formatPKR(fin.position.overdue)} overdue
                    </Link>
                  )}
                </div>
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-sm text-muted-foreground">You owe bike sellers</p>
                    <Link href="/bikes?status=owed" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                      {formatNumber(fin.position.payableBikes)} bikes
                    </Link>
                  </div>
                  <p className="mt-1 text-2xl font-semibold tabular-nums">
                    <CountUp value={youOwe} prefix="Rs " />
                  </p>
                </div>
                {owedToYou + youOwe > 0 && (
                  <div className="space-y-2">
                    <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full" role="img" aria-label={`Owed to you ${formatPKR(owedToYou)}, you owe ${formatPKR(youOwe)}`}>
                      <div className="rounded-l-full" style={{ width: `${(owedToYou / (owedToYou + youOwe)) * 100}%`, background: "var(--viz-1)" }} />
                      <div className="rounded-r-full" style={{ width: `${(youOwe / (owedToYou + youOwe)) * 100}%`, background: "var(--viz-2)" }} />
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-sm" style={{ background: "var(--viz-1)" }} /> Owed to you
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-sm" style={{ background: "var(--viz-2)" }} /> You owe
                      </span>
                    </div>
                    <p className="border-t pt-3 text-sm">
                      Net owed to you <span className="float-right font-semibold tabular-nums">{formatPKR(owedToYou - youOwe)}</span>
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Key numbers with 12-month trends */}
          <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StaggerItem>
              <SparkKpi label="Sales" icon={TrendingUpIcon} value={fin.kpis.sales.value} previous={fin.kpis.sales.previous} compareLabel={compareLabel} trend={trend} trendKey="salesTotal" />
            </StaggerItem>
            <StaggerItem>
              <SparkKpi
                label="Installments collected"
                icon={BanknoteIcon}
                value={fin.kpis.collections.value}
                previous={fin.kpis.collections.previous}
                compareLabel={compareLabel}
                trend={trend}
                trendKey="collections"
                color="var(--viz-3)"
                href={show.installments ? "/dashboard/installments" : undefined}
              />
            </StaggerItem>
            <StaggerItem>
              <SparkKpi
                label="Bikes sold"
                icon={BikeIcon}
                money={false}
                value={fin.kpis.bikesSold.value}
                previous={fin.kpis.bikesSold.previous}
                compareLabel={compareLabel}
                trend={trend}
                trendKey="bikesSold"
                href={show.showroom ? "/dashboard/showroom" : undefined}
              />
            </StaggerItem>
            <StaggerItem>
              <SparkKpi
                label="New customers"
                icon={UsersIcon}
                money={false}
                value={fin.kpis.newCustomers.value}
                previous={fin.kpis.newCustomers.previous}
                compareLabel={compareLabel}
                trend={trend}
                trendKey="newCustomers"
                color="var(--viz-3)"
                href="/customers"
              />
            </StaggerItem>
          </Stagger>

          {/* The two businesses */}
          {(show.installments || show.showroom) && (
            <div className="grid gap-6 lg:grid-cols-2">
              {show.installments && inst && (
                <BusinessCard
                  icon={FileTextIcon}
                  title="Installments"
                  href="/dashboard/installments"
                  figures={[
                    { label: "Active plans", value: formatNumber(inst.activeCount) },
                    { label: "Owed by customers", value: formatPKR(inst.outstanding) },
                    { label: "Late plans", value: formatNumber(inst.lateCount), tone: inst.lateCount ? "text-destructive" : "" },
                    { label: `Collected (${fin.range.label.toLowerCase()})`, value: formatPKR(fin.kpis.collections.value) },
                  ]}
                />
              )}
              {show.showroom && (
                <BusinessCard
                  icon={BikeIcon}
                  title="Showroom"
                  href="/dashboard/showroom"
                  figures={[
                    { label: "Bikes in stock", value: formatNumber(fin.position.stockCount) },
                    { label: "Stock value", value: formatPKR(fin.position.stockValue) },
                    { label: `Sold (${fin.range.label.toLowerCase()})`, value: formatNumber(fin.kpis.bikesSold.value) },
                    { label: "Owed to sellers", value: formatPKR(fin.position.payables) },
                  ]}
                />
              )}
            </div>
          )}

          {/* Money trends and breakdowns */}
          <div className="grid gap-6 xl:grid-cols-3">
            <ChartCard
              className="xl:col-span-2"
              title="Cash flow"
              description={thisMonth ? `Last 12 months. This month: ${formatPKR(thisMonth.cashIn)} in, ${formatPKR(thisMonth.cashOut)} out.` : "Last 12 months."}
              table={trendTable}
            >
              <CashFlowChart data={trend} />
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
                <span className="inline-flex flex-wrap items-center gap-2">
                  Last 12 months, counted when the sale is made.
                  <span className="inline-flex items-center gap-1.5">
                    {fin.range.label}: <span className="font-medium text-foreground">{formatPKR(fin.kpis.sales.value)}</span>
                    <DeltaChip value={fin.kpis.sales.value} previous={fin.kpis.sales.previous} />
                  </span>
                </span>
              }
              table={salesTable}
            >
              <SalesChart data={trend} />
            </ChartCard>
            <ChartCard title="Where money went" description={fin.range.label}>
              <BreakdownBars items={fin.moneyOut} tone="out" empty="No cash paid out in this period." />
            </ChartCard>
          </div>
        </>
      )}

      <div className="grid gap-6 xl:grid-cols-3">
        {inst && (
          <Card className={data.activity ? "xl:col-span-2" : "xl:col-span-3"}>
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
        {data.activity && (
          <Card className={inst ? "" : "xl:col-span-3"}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HistoryIcon className="size-4 text-muted-foreground" /> Recent activity
              </CardTitle>
              <CardDescription>What staff have done lately.</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[26rem] overflow-y-auto">
              <ActivityList events={data.activity} showEntity />
            </CardContent>
          </Card>
        )}
      </div>

      {!fin && !inst && !data.activity && (
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Your account does not have access to any modules yet. Ask the Superadmin to grant the permissions you need.</CardDescription>
          </CardHeader>
        </Card>
      )}
    </PageBody>
  );
}
