import Link from "next/link";
import { Suspense } from "react";
import { ArrowRightIcon, BikeIcon, HandCoinsIcon, HourglassIcon, PackageIcon, PlusIcon, ShoppingBagIcon, TimerIcon, TrendingUpIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ConditionBadge, bikeNo } from "@/components/app/bike-ui";
import { ChartCard } from "@/components/app/charts/chart-card";
import { ColumnChart, RankBars } from "@/components/app/charts/finance-charts";
import { CountUp } from "@/components/app/count-up";
import { Stagger, StaggerItem } from "@/components/app/motion";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { getShowroomInsights } from "@/server/services/insights/showroom";
import { formatBusinessDate } from "@/lib/business-date";
import { formatNumber, formatPKR } from "@/lib/format";
import { COMPARE, DashboardTabs, PeriodTabs, readPeriod } from "../dashboard-nav";
import { Figure, SparkKpi } from "../kpi";

export const metadata = { title: "Showroom dashboard" };

export default function ShowroomDashboardPage({ searchParams }) {
  return (
    <Suspense fallback={<PageSkeleton variant="cards" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

function BikeRow({ b, right, condition = false }) {
  return (
    <li>
      <Link href={`/bikes/${b.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60">
        <span className="w-12 shrink-0 font-mono text-sm font-semibold">{bikeNo(b.bikeNumber)}</span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-sm font-medium">
            <span className="truncate">{b.label}</span> {condition && <ConditionBadge condition={b.condition} />}
          </p>
          <p className="truncate text-xs text-muted-foreground">{b.sub}</p>
        </div>
        <div className="shrink-0 text-right">{right}</div>
      </Link>
    </li>
  );
}

function ListCard({ icon: Icon, title, description, action, children, empty }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-muted-foreground" /> {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent>
        {empty ? (
          <Empty className="border py-8">
            <EmptyHeader>
              <EmptyTitle className="text-sm">{empty.title}</EmptyTitle>
              <EmptyDescription>{empty.text}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <ul className="-mx-2 divide-y">{children}</ul>
        )}
      </CardContent>
    </Card>
  );
}

async function Content({ searchParams }) {
  const actor = await requireStaffPage("bikes.view");
  const period = readPeriod(await searchParams);
  const d = await getShowroomInsights(actor, period);
  const compareLabel = COMPARE[period];
  const show = { installments: can(actor, "installments.view"), showroom: true };
  const flowTable = {
    columns: [
      { key: "label", label: "Month" },
      { key: "bought", label: "Bought", align: "right" },
      { key: "sold", label: "Sold", align: "right" },
    ],
    rows: d.trend.map((t) => ({ key: t.month, label: t.label, bought: formatNumber(t.bought), sold: formatNumber(t.sold) })),
  };
  const salesTable = {
    columns: [
      { key: "label", label: "Month" },
      { key: "inst", label: "On installments", align: "right" },
      { key: "cash", label: "Cash", align: "right" },
      { key: "total", label: "Total", align: "right" },
    ],
    rows: d.trend.map((t) => ({ key: t.month, label: t.label, inst: formatPKR(t.salesInstallment), cash: formatPKR(t.salesCash), total: formatPKR(t.salesInstallment + t.salesCash) })),
  };
  const stockShare = d.position.inStock ? Math.round((d.position.newInStock / d.position.inStock) * 100) : 0;

  return (
    <PageBody>
      <PageHeader
        icon={BikeIcon}
        title="Showroom"
        description="How the bike business is doing: stock, what sells, and what is owed to sellers."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/bikes">
                All bikes <ArrowRightIcon />
              </Link>
            </Button>
            {can(actor, "bikes.create") && (
              <Button asChild>
                <Link href="/bikes/new">
                  <PlusIcon /> Add bike purchase
                </Link>
              </Button>
            )}
          </>
        }
      />
      <DashboardTabs current="showroom" show={show} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{d.range.label.toLowerCase()}</span>; stock is as of today.
        </p>
        <PeriodTabs period={period} basePath="/dashboard/showroom" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="relative gap-0 overflow-hidden py-0 xl:col-span-2">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-brand shadow-[0_0_12px_var(--brand)]" />
          <div className="grid flex-1 gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Bikes in stock</p>
              <p className="mt-1 flex items-baseline gap-3">
                <span className="text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
                  <CountUp value={d.position.inStock} />
                </span>
                <span className="text-lg text-muted-foreground tabular-nums">worth {formatPKR(d.position.stockValue)}</span>
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Valued at purchase price.</p>
            </div>
            <div className="w-full min-w-56 space-y-2 md:w-64">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>New {d.position.newInStock}</span>
                <span>Used {d.position.usedInStock}</span>
              </div>
              <div className="flex h-2.5 gap-[2px] overflow-hidden rounded-full bg-muted" role="img" aria-label={`${d.position.newInStock} new and ${d.position.usedInStock} used bikes in stock`}>
                {d.position.inStock > 0 && (
                  <>
                    <div className="rounded-l-full" style={{ width: `${stockShare}%`, background: "var(--viz-1)" }} />
                    <div className="rounded-r-full" style={{ width: `${100 - stockShare}%`, background: "var(--viz-3)" }} />
                  </>
                )}
              </div>
              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm" style={{ background: "var(--viz-1)" }} /> New
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-sm" style={{ background: "var(--viz-3)" }} /> Used
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px border-t bg-border sm:grid-cols-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
            <div className="min-w-0 bg-card px-4 py-3.5 sm:px-6 sm:py-4">
              <Figure label="Owed to sellers" value={d.position.owedToSellers} sub={`On ${d.position.owedBikes} ${d.position.owedBikes === 1 ? "bike" : "bikes"}`} />
            </div>
            <div className="min-w-0 bg-card px-4 py-3.5 sm:px-6 sm:py-4">
              <Figure label={`Spent buying (${d.range.label.toLowerCase()})`} value={d.kpis.bought.spend} sub={`${d.kpis.bought.value} ${d.kpis.bought.value === 1 ? "bike" : "bikes"} bought`} />
            </div>
            <div className="min-w-0 bg-card px-4 py-3.5 sm:px-6 sm:py-4">
              <p className="text-xs text-muted-foreground">Average days to sell</p>
              <p className="mt-1 text-lg font-semibold tabular-nums">{d.kpis.avgDaysToSell == null ? "—" : `${d.kpis.avgDaysToSell} days`}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">From purchase to sale, last 12 months</p>
            </div>
          </div>
        </Card>
        <ChartCard title="Stock by make" description="Bikes in stock, by purchase value">
          <RankBars items={d.byMake} unit={["bike", "bikes"]} empty="No bikes in stock." />
        </ChartCard>
      </div>

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <SparkKpi label="Bikes sold" icon={ShoppingBagIcon} money={false} value={d.kpis.sold.value} previous={d.kpis.sold.previous} compareLabel={compareLabel} trend={d.trend} trendKey="sold" />
        </StaggerItem>
        <StaggerItem>
          <SparkKpi
            label="Sales value"
            icon={TrendingUpIcon}
            value={d.kpis.salesValue.value}
            previous={d.kpis.salesValue.previous}
            hint={`${formatPKR(d.kpis.salesValue.cash)} of it in cash sales`}
            trend={d.trend.map((t) => ({ ...t, salesTotal: t.salesCash + t.salesInstallment }))}
            trendKey="salesTotal"
            color="var(--viz-3)"
          />
        </StaggerItem>
        <StaggerItem>
          <SparkKpi label="Bikes bought" icon={PackageIcon} money={false} value={d.kpis.bought.value} previous={d.kpis.bought.previous} goodWhen={null} compareLabel={compareLabel} trend={d.trend} trendKey="bought" />
        </StaggerItem>
        <StaggerItem>
          <SparkKpi label="Owed to sellers" icon={HandCoinsIcon} value={d.position.owedToSellers} hint={d.position.owedBikes ? `${d.position.owedBikes} sellers still to pay` : "All sellers paid"} href="/bikes?status=owed" />
        </StaggerItem>
      </Stagger>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Bought vs sold" description="Number of bikes, last 12 months" table={flowTable}>
          <ColumnChart
            data={d.trend}
            money={false}
            series={[
              { key: "bought", label: "Bought", color: "var(--viz-2)" },
              { key: "sold", label: "Sold", color: "var(--viz-1)" },
            ]}
          />
        </ChartCard>
        <ChartCard title="Bike sales value" description="Cash and installment bike sales, last 12 months" table={salesTable}>
          <ColumnChart
            data={d.trend}
            stacked
            series={[
              { key: "salesInstallment", label: "On installments", color: "var(--viz-1)" },
              { key: "salesCash", label: "Cash sales", color: "var(--viz-3)" },
            ]}
          />
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard title="How long bikes have been in stock" description="Bikes in stock, by days since purchase">
          <RankBars items={d.age} money={false} tone="out" empty="No bikes in stock." />
        </ChartCard>
        <ListCard
          icon={HourglassIcon}
          title="Oldest stock"
          description="In stock the longest. Worth a push."
          empty={d.oldestStock.length ? null : { title: "No bikes in stock", text: "Bikes you buy will show here." }}
        >
          {d.oldestStock.map((b) => (
            <BikeRow
              key={b.id}
              b={{ ...b, sub: `Bought ${formatBusinessDate(b.purchaseDate)}` }}
              right={
                <Badge variant="outline" className="gap-1 tabular-nums">
                  <TimerIcon /> {b.daysInStock} days
                </Badge>
              }
            />
          ))}
        </ListCard>
        <ListCard
          icon={HandCoinsIcon}
          title="Still owed to sellers"
          description="Largest amounts first."
          action={
            <Button variant="ghost" size="sm" asChild>
              <Link href="/bikes?status=owed">
                All <ArrowRightIcon />
              </Link>
            </Button>
          }
          empty={d.owed.length ? null : { title: "All sellers paid", text: "Amounts owed to sellers will show here." }}
        >
          {d.owed.map((b) => (
            <BikeRow key={b.id} b={{ ...b, sub: `From ${b.seller}` }} right={<span className="text-sm font-medium tabular-nums">{formatPKR(b.payable)}</span>} />
          ))}
        </ListCard>
      </div>

      <ListCard
        icon={ShoppingBagIcon}
        title="Recent sales"
        description="The latest bikes sold."
        empty={d.recentSales.length ? null : { title: "No bikes sold yet", text: "Sales will show here." }}
      >
        {d.recentSales.map((b) => (
          <BikeRow
            key={b.id}
            condition
            b={{ ...b, sub: `To ${b.sale.customer} · ${formatBusinessDate(b.sale.date)}` }}
            right={
              <div className="flex items-center gap-3">
                <Badge variant="outline">{b.sale.mode === "cash" ? "Cash" : "Installments"}</Badge>
                <span className="w-28 text-sm font-medium tabular-nums">{formatPKR(b.sale.price)}</span>
              </div>
            }
          />
        ))}
      </ListCard>
    </PageBody>
  );
}
