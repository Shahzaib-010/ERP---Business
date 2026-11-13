import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  BikeIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  DownloadIcon,
  FileTextIcon,
  HistoryIcon,
  LandmarkIcon,
  PrinterIcon,
  ScaleIcon,
  UserPlusIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActivityList } from "@/components/app/activity-list";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { getDailyReport } from "@/server/services/reports";
import { ValidationError } from "@/server/errors";
import { formatBusinessDate, todayPk } from "@/lib/business-date";
import { formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Daily report" };

export default function DailyReportPage({ searchParams }) {
  return (
    <Suspense fallback={<PageSkeleton variant="cards" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }) {
  const actor = await requireStaffPage("transactions.view");
  const sp = await searchParams;
  let r;
  try {
    r = await getDailyReport(actor, { date: typeof sp.date === "string" ? sp.date : undefined });
  } catch (err) {
    if (!(err instanceof ValidationError)) throw err;
    r = await getDailyReport(actor, {}); // bad or future date: show today
  }
  const m = r.money;
  const q = `?date=${r.date}`;

  const cards = [
    { label: "Cash at start of day", value: m.opening, icon: LandmarkIcon, tone: "text-muted-foreground" },
    { label: "Money in", value: m.cashIn, icon: ArrowDownLeftIcon, tone: "text-success" },
    { label: "Money out", value: m.cashOut, icon: ArrowUpRightIcon, tone: "text-warning-foreground dark:text-warning" },
    { label: "Cash at end of day", value: m.closing, icon: WalletIcon, tone: "text-primary", accent: true },
  ];
  const inParts = [
    ["Installments & advances", m.parts.installments],
    ["Cash bike sales", m.parts.bikeCashSales],
    ["Other income", m.parts.otherIncome],
    ["Owner investment", m.parts.ownerInvestment],
  ];
  const outParts = [
    ["Payments to sellers", m.parts.sellerPayments],
    ["Expenses", m.parts.expenses],
    ["Owner withdrawal", m.parts.ownerWithdrawal],
    ["Items bought for plans", m.parts.itemPurchases],
  ];
  const newCount = (r.customers?.length ?? 0) + (r.plans?.length ?? 0) + (r.bikesBought?.length ?? 0) + (r.bikesSold?.length ?? 0);

  return (
    <PageBody>
      <PageHeader
        icon={ClipboardListIcon}
        title="Daily report"
        description={`Everything recorded on ${formatBusinessDate(r.date)}${r.isToday ? " (today, so far)" : ""}: cash, new records and staff activity.`}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" asChild>
              <a href={`/reports/daily/print${q}`} target="_blank" rel="noopener noreferrer">
                <PrinterIcon /> Print
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={`/reports/daily/print${q}&pdf=1`} target="_blank" rel="noopener noreferrer">
                <FileTextIcon /> PDF
              </a>
            </Button>
            <Button asChild>
              <a href={`/api/reports/daily${q}`}>
                <DownloadIcon /> Excel
              </a>
            </Button>
          </div>
        }
      />

      {/* Day picker */}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" asChild aria-label="Previous day">
          <Link href={`/reports/daily?date=${r.previousDate}`}>
            <ChevronLeftIcon />
          </Link>
        </Button>
        <form action="/reports/daily" className="flex items-center gap-2">
          <Input type="date" name="date" defaultValue={r.date} max={todayPk()} className="w-40" aria-label="Report date" />
          <Button type="submit" variant="secondary">
            Show
          </Button>
        </form>
        {r.nextDate ? (
          <Button variant="outline" size="icon" asChild aria-label="Next day">
            <Link href={`/reports/daily?date=${r.nextDate}`}>
              <ChevronRightIcon />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="icon" disabled aria-label="Next day">
            <ChevronRightIcon />
          </Button>
        )}
        {!r.isToday && (
          <Button variant="ghost" asChild>
            <Link href="/reports/daily">Today</Link>
          </Button>
        )}
      </div>

      {/* Cash summary */}
      <Card className="gap-0 overflow-hidden py-0">
        <div className="grid grid-cols-2 gap-px bg-border lg:grid-cols-4">
          {cards.map((c) => (
            <div key={c.label} className="relative min-w-0 bg-card px-4 py-3.5 sm:px-5 sm:py-4">
              {c.accent && <div className="absolute inset-x-0 top-0 h-0.5 bg-brand shadow-[0_0_10px_var(--brand)]" />}
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <c.icon className={cn("size-3.5", c.tone)} /> {c.label}
              </p>
              <p className={cn("mt-1 truncate text-lg font-semibold tabular-nums sm:text-2xl", c.value < 0 && "text-destructive")}>{formatPKR(c.value)}</p>
            </div>
          ))}
        </div>
        <div className="grid gap-px border-t bg-border sm:grid-cols-2">
          <Breakdown title="Money in" rows={inParts} total={m.cashIn} />
          <Breakdown title="Money out" rows={outParts} total={m.cashOut} />
        </div>
        <p className="flex items-center gap-1.5 border-t px-5 py-2.5 text-xs text-muted-foreground">
          <ScaleIcon className="size-3.5" /> Net for the day:{" "}
          <span className={cn("font-medium tabular-nums", m.net < 0 ? "text-destructive" : "text-foreground")}>{formatPKR(m.net)}</span>
        </p>
      </Card>

      {/* Cash movements */}
      <Card className="gap-0 overflow-hidden py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-base">Cash movements</CardTitle>
          <CardDescription>
            {r.entries.length === 0 ? "No money came in or went out on this day." : `${r.entries.length} ${r.entries.length === 1 ? "entry" : "entries"}, in the order they were recorded.`}
          </CardDescription>
        </CardHeader>
        {r.entries.length > 0 && (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="pl-4">Details</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="hidden text-right sm:table-cell">In</TableHead>
                <TableHead className="hidden pr-4 text-right sm:table-cell">Out</TableHead>
                <TableHead className="pr-4 text-right sm:hidden">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {r.entries.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="max-w-48 pl-4 sm:max-w-[26rem]">
                    {e.href ? (
                      <Link href={e.href} className="block truncate font-medium hover:underline">
                        {e.title}
                      </Link>
                    ) : (
                      <span className="block truncate font-medium">{e.title}</span>
                    )}
                    <p className="truncate text-xs text-muted-foreground">
                      {[e.detail, e.reference].filter(Boolean).join(" · ") || "—"}
                      <span className="md:hidden"> · {e.categoryLabel ?? e.sourceLabel}</span>
                    </p>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className="gap-1.5 font-normal">
                      <span className={cn("size-1.5 rounded-full", e.direction === "in" ? "bg-success" : "bg-warning")} aria-hidden="true" />
                      {e.categoryLabel ? `${e.sourceLabel}: ${e.categoryLabel}` : e.sourceLabel}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden text-right font-medium tabular-nums text-success sm:table-cell">{e.direction === "in" ? formatPKR(e.amount) : ""}</TableCell>
                  <TableCell className="hidden pr-4 text-right font-medium tabular-nums sm:table-cell">{e.direction === "out" ? formatPKR(e.amount) : ""}</TableCell>
                  <TableCell className={cn("pr-4 text-right font-medium tabular-nums sm:hidden", e.direction === "in" && "text-success")}>
                    {e.direction === "in" ? "+" : "−"}
                    {formatPKR(e.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* New records */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New records</CardTitle>
          <CardDescription>{newCount === 0 ? "Nothing new was added on this day." : "Customers, plans and bikes added on this day."}</CardDescription>
        </CardHeader>
        {newCount > 0 && (
          <CardContent className="grid gap-4 md:grid-cols-2">
            {r.customers?.length > 0 && (
              <RecordGroup icon={UserPlusIcon} title="New customers" count={r.customers.length}>
                {r.customers.map((c) => (
                  <RecordRow key={c.id} href={`/customers/${c.id}`} title={c.name} />
                ))}
              </RecordGroup>
            )}
            {r.plans?.length > 0 && (
              <RecordGroup icon={FileTextIcon} title="New installment plans" count={r.plans.length}>
                {r.plans.map((p) => (
                  <RecordRow key={p.id} href={`/plans/${p.id}`} title={`#${p.accountNumber} · ${p.customerName}`} sub={p.item} amount={p.agreedTotal} />
                ))}
              </RecordGroup>
            )}
            {r.bikesBought?.length > 0 && (
              <RecordGroup icon={BikeIcon} title="Bikes bought" count={r.bikesBought.length}>
                {r.bikesBought.map((b) => (
                  <RecordRow key={b.id} href={`/bikes/${b.id}`} title={`B-${b.bikeNumber} · ${b.label}`} sub={`from ${b.seller}${b.owed ? ` · owe ${formatPKR(b.owed)}` : ""}`} amount={b.price} />
                ))}
              </RecordGroup>
            )}
            {r.bikesSold?.length > 0 && (
              <RecordGroup icon={BikeIcon} title="Bikes sold" count={r.bikesSold.length}>
                {r.bikesSold.map((b) => (
                  <RecordRow key={b.id} href={`/bikes/${b.id}`} title={`B-${b.bikeNumber} · ${b.label}`} sub={`to ${b.customerName} · ${b.mode === "cash" ? "cash" : "installments"}`} amount={b.price} />
                ))}
              </RecordGroup>
            )}
          </CardContent>
        )}
      </Card>

      {/* Staff activity */}
      {r.activity && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HistoryIcon className="size-4 text-muted-foreground" /> Activity log
              </CardTitle>
              <CardDescription>
                {r.activityTotal > r.activity.length
                  ? `The latest ${r.activity.length} of ${r.activityTotal} changes made on this day, newest first.`
                  : "Every change made in the app on this day, newest first."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ActivityList events={[...r.activity].reverse()} showEntity emptyText="No activity on this day." />
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <UsersIcon className="size-4 text-muted-foreground" /> By staff
              </CardTitle>
              <CardDescription>Number of changes each person made.</CardDescription>
            </CardHeader>
            <CardContent>
              {r.staff.length === 0 ? (
                <p className="text-sm text-muted-foreground">No one made changes on this day.</p>
              ) : (
                <ul className="space-y-2">
                  {r.staff.map((s) => (
                    <li key={s.name} className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate">{s.name}</span>
                      <Badge variant="secondary" className="tabular-nums">
                        {s.count}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </PageBody>
  );
}

function Breakdown({ title, rows, total }) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">{title}</p>
      <dl className="space-y-1.5 text-sm">
        {rows.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className={cn(value === 0 && "text-muted-foreground")}>{label}</dt>
            <dd className={cn("tabular-nums", value === 0 ? "text-muted-foreground" : "font-medium")}>{formatPKR(value)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-4 border-t pt-1.5 font-semibold">
          <dt>Total</dt>
          <dd className="tabular-nums">{formatPKR(total)}</dd>
        </div>
      </dl>
    </div>
  );
}

function RecordGroup({ icon: Icon, title, count, children }) {
  return (
    <div className="rounded-lg border">
      <p className="flex items-center gap-2 border-b px-3 py-2 text-sm font-medium">
        <Icon className="size-4 text-muted-foreground" /> {title}
        <Badge variant="secondary" className="ml-auto tabular-nums">
          {count}
        </Badge>
      </p>
      <ul className="divide-y">{children}</ul>
    </div>
  );
}

function RecordRow({ href, title, sub, amount }) {
  return (
    <li className="flex items-center gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <Link href={href} className="block truncate text-sm font-medium hover:underline">
          {title}
        </Link>
        {sub && <p className="truncate text-xs text-muted-foreground">{sub}</p>}
      </div>
      {amount != null && <span className="shrink-0 text-sm tabular-nums">{formatPKR(amount)}</span>}
    </li>
  );
}
