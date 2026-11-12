import Link from "next/link";
import { Suspense } from "react";
import { AlarmClockIcon, ArrowRightIcon, BanknoteIcon, CalendarClockIcon, CheckCircle2Icon, FilePlus2Icon, FileTextIcon, PhoneIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { ChartCard } from "@/components/app/charts/chart-card";
import { AgingBreakdown, ColumnChart, RankBars } from "@/components/app/charts/finance-charts";
import { CountUp } from "@/components/app/count-up";
import { Stagger, StaggerItem } from "@/components/app/motion";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PlanProgress, PlanStatusBadge } from "@/components/app/plan-ui";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { getInstallmentInsights } from "@/server/services/insights/installments";
import { formatBusinessDate } from "@/lib/business-date";
import { formatNumber, formatPKR } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { COMPARE, DashboardTabs, PeriodTabs, readPeriod } from "../dashboard-nav";
import { Figure, SparkKpi } from "../kpi";

export const metadata = { title: "Installments dashboard" };

export default function InstallmentsDashboardPage({ searchParams }) {
  return (
    <Suspense fallback={<PageSkeleton variant="cards" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

function PlanList({ rows, empty, mode }) {
  if (!rows.length)
    return (
      <Empty className="border py-8">
        <EmptyHeader>
          <EmptyTitle className="text-sm">{empty.title}</EmptyTitle>
          <EmptyDescription>{empty.text}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  return (
    <ul className="-mx-2 divide-y">
      {rows.map((p) => (
        <li key={p.id}>
          <Link href={`/plans/${p.id}`} className="flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60">
            <span className="w-14 shrink-0 font-mono text-sm font-semibold">#{p.accountNumber}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{p.customer}</p>
              <p className="flex items-center gap-1.5 truncate text-xs text-muted-foreground">
                {p.phone && (
                  <>
                    <PhoneIcon className="size-3" /> <span className="font-mono">{formatPhone(p.phone)}</span> ·
                  </>
                )}
                <span className="truncate">{p.item}</span>
              </p>
            </div>
            {mode === "due" && (
              <div className="text-right">
                <p className="text-sm font-medium tabular-nums">{formatPKR(p.nextDue.amount)}</p>
                <p className="text-xs text-muted-foreground">{formatBusinessDate(p.nextDue.dueDate)}</p>
              </div>
            )}
            {mode === "late" && (
              <>
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-medium tabular-nums text-destructive">{formatPKR(p.overdue.amount)}</p>
                  <p className="text-xs text-muted-foreground">overdue</p>
                </div>
                <PlanStatusBadge status={p.status} overdue={p.overdue} />
              </>
            )}
            {mode === "balance" && (
              <div className="w-28 shrink-0 text-right">
                <p className="text-sm font-medium tabular-nums">{formatPKR(p.balance)}</p>
                <PlanProgress percent={p.percent} status={p.status} overdue={p.overdue} className="mt-1.5" />
              </div>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

async function Content({ searchParams }) {
  const actor = await requireStaffPage("installments.view");
  const period = readPeriod(await searchParams);
  const d = await getInstallmentInsights(actor, period);
  const compareLabel = COMPARE[period];
  const show = { installments: true, showroom: can(actor, "bikes.view") };
  const thisMonth = d.trend.at(-1);
  const rate = d.position.onTimeRate;

  const trendTable = {
    columns: [
      { key: "label", label: "Month" },
      { key: "expected", label: "Expected", align: "right" },
      { key: "collected", label: "Collected", align: "right" },
      { key: "pct", label: "Collected %", align: "right" },
    ],
    rows: d.trend.map((t) => ({
      key: t.month,
      label: t.label,
      expected: formatPKR(t.expected),
      collected: formatPKR(t.collected),
      pct: t.expected ? `${Math.round((t.collected / t.expected) * 100)}%` : "—",
    })),
  };
  const newTable = {
    columns: [
      { key: "label", label: "Month" },
      { key: "count", label: "New plans", align: "right" },
      { key: "value", label: "Total value", align: "right" },
    ],
    rows: d.trend.map((t) => ({ key: t.month, label: t.label, count: formatNumber(t.newPlans), value: formatPKR(t.newValue) })),
  };

  return (
    <PageBody>
      <PageHeader
        icon={FileTextIcon}
        title="Installments"
        description="How the installment business is doing: what is owed, what is coming in, and who is behind."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/plans">
                All plans <ArrowRightIcon />
              </Link>
            </Button>
            {can(actor, "installments.create") && (
              <Button asChild>
                <Link href="/plans/new">
                  <FilePlus2Icon /> New plan
                </Link>
              </Button>
            )}
          </>
        }
      />
      <DashboardTabs current="installments" show={show} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Showing <span className="font-medium text-foreground">{d.range.label.toLowerCase()}</span>; balances are as of today.
        </p>
        <PeriodTabs period={period} basePath="/dashboard/installments" />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="relative gap-0 overflow-hidden py-0 xl:col-span-2">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-brand shadow-[0_0_12px_var(--brand)]" />
          <div className="grid flex-1 gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Owed by customers</p>
              <p className="mt-1 text-4xl font-semibold tracking-tight tabular-nums sm:text-5xl">
                <CountUp value={d.position.receivables} prefix="Rs " />
              </p>
              <p className="mt-1 text-xs text-muted-foreground">On {formatNumber(d.position.activePlans)} active plans</p>
            </div>
            {/* On-time rate ring */}
            <div className="flex items-center gap-4">
              <svg viewBox="0 0 36 36" className="size-20 -rotate-90" role="img" aria-label={`${rate}% of active plans are on time`}>
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--muted)" strokeWidth="3.5" />
                <circle
                  cx="18"
                  cy="18"
                  r="15.5"
                  fill="none"
                  stroke="var(--status-good)"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeDasharray={`${(rate / 100) * 97.4} 97.4`}
                  className="transition-[stroke-dasharray] duration-1000"
                />
              </svg>
              <div>
                <p className="text-2xl font-semibold tabular-nums">{rate}%</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <CheckCircle2Icon className="size-3 text-success" /> plans on time
                </p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-px border-t bg-border sm:grid-cols-3 [&>*:last-child]:col-span-2 sm:[&>*:last-child]:col-span-1">
            <div className="min-w-0 bg-card px-4 py-3.5 sm:px-6 sm:py-4">
              <Figure label="Overdue now" value={d.position.overdue} sub={`${d.position.lateCount} late ${d.position.lateCount === 1 ? "plan" : "plans"}`} />
            </div>
            <div className="min-w-0 bg-card px-4 py-3.5 sm:px-6 sm:py-4">
              <Figure label="Due in the next 30 days" value={d.position.dueNext30} sub={`${d.position.dueNext30Count} ${d.position.dueNext30Count === 1 ? "payment" : "payments"} expected`} />
            </div>
            <div className="min-w-0 bg-card px-4 py-3.5 sm:px-6 sm:py-4">
              <Figure label={`Collected (${d.range.label.toLowerCase()})`} value={d.kpis.collected.value} previous={d.kpis.collected.previous} sub={`${d.kpis.collected.count} payments`} />
            </div>
          </div>
        </Card>
        <ChartCard title="Receivables health" description="How late the money owed is">
          <AgingBreakdown buckets={d.aging} total={d.position.receivables} />
        </ChartCard>
      </div>

      <Stagger className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StaggerItem>
          <SparkKpi label="Collected" icon={BanknoteIcon} value={d.kpis.collected.value} previous={d.kpis.collected.previous} compareLabel={compareLabel} trend={d.trend} trendKey="collected" color="var(--viz-3)" />
        </StaggerItem>
        <StaggerItem>
          <SparkKpi label="New plans" icon={FilePlus2Icon} money={false} value={d.kpis.newPlans.value} previous={d.kpis.newPlans.previous} compareLabel={compareLabel} trend={d.trend} trendKey="newPlans" />
        </StaggerItem>
        <StaggerItem>
          <SparkKpi label="Value of new plans" icon={WalletIcon} value={d.kpis.newPlans.worth} compareLabel={compareLabel} hint={d.kpis.avgPlan ? `Average ${formatPKR(d.kpis.avgPlan)} per plan` : "No new plans"} trend={d.trend} trendKey="newValue" />
        </StaggerItem>
        <StaggerItem>
          <SparkKpi label="Plans completed" icon={CheckCircle2Icon} money={false} value={d.kpis.completed} hint={`Fully paid in ${d.range.label.toLowerCase()}`} />
        </StaggerItem>
      </Stagger>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard
          className="xl:col-span-2"
          title="Expected vs collected"
          description={
            thisMonth
              ? `What the schedules expected each month, and what came in. This month: ${formatPKR(thisMonth.collected)} of ${formatPKR(thisMonth.expected)}.`
              : "Last 12 months."
          }
          table={trendTable}
        >
          <ColumnChart
            data={d.trend}
            series={[
              { key: "expected", label: "Expected", color: "var(--viz-2)" },
              { key: "collected", label: "Collected", color: "var(--viz-1)" },
            ]}
          />
        </ChartCard>
        <ChartCard title="Owed by item type" description="Balances on active plans">
          <RankBars items={d.byKind} unit={["plan", "plans"]} empty="No active plans." />
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarClockIcon className="size-4 text-muted-foreground" /> Due in the next 30 days
            </CardTitle>
            <CardDescription>Soonest first. A good list for reminder calls.</CardDescription>
          </CardHeader>
          <CardContent>
            <PlanList rows={d.dueSoon} mode="due" empty={{ title: "Nothing due soon", text: "No installments fall due in the next 30 days." }} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlarmClockIcon className="size-4 text-destructive" /> Late plans
            </CardTitle>
            <CardDescription>Furthest behind first.</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/plans?status=late">
                  All <ArrowRightIcon />
                </Link>
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <PlanList rows={d.late} mode="late" empty={{ title: "Everyone is up to date", text: "Late plans will show here." }} />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <ChartCard className="xl:col-span-2" title="New plans per month" description="Last 12 months" table={newTable}>
          <ColumnChart data={d.trend} money={false} series={[{ key: "newPlans", label: "New plans", color: "var(--viz-1)" }]} height="h-60" />
        </ChartCard>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Largest balances</CardTitle>
            <CardDescription>Active plans with the most still owed.</CardDescription>
          </CardHeader>
          <CardContent>
            <PlanList rows={d.topBalances} mode="balance" empty={{ title: "No active plans", text: "Balances will show here." }} />
          </CardContent>
        </Card>
      </div>
    </PageBody>
  );
}
