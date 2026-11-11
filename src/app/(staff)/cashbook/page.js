import Link from "next/link";
import { Suspense } from "react";
import { ArrowDownLeftIcon, ArrowUpRightIcon, BookOpenIcon, ChevronLeftIcon, ChevronRightIcon, LandmarkIcon, ScaleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CountUp } from "@/components/app/count-up";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { listCashbook } from "@/server/services/cashbook";
import { PERIODS } from "@/lib/cashbook";
import { formatBusinessDate } from "@/lib/business-date";
import { formatNumber, formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { createTransactionAction, voidTransactionAction } from "./actions";
import { AddEntryDialog, VoidEntryButton } from "./entry-dialogs";

export const metadata = { title: "Cash book" };

const DIRECTIONS = [
  { key: "all", label: "All" },
  { key: "in", label: "Money in" },
  { key: "out", label: "Money out" },
];

export default function CashbookPage({ searchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CashbookContent searchParams={searchParams} />
    </Suspense>
  );
}

function Tabs({ items, current, href }) {
  return (
    <nav className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1">
      {items.map((t) => (
        <Link
          key={t.key}
          href={href(t.key)}
          aria-current={current === t.key ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1 text-sm whitespace-nowrap transition-colors",
            current === t.key ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t.label}
        </Link>
      ))}
    </nav>
  );
}

async function CashbookContent({ searchParams }) {
  const actor = await requireStaffPage("transactions.view");
  const sp = await searchParams;
  const data = await listCashbook(actor, { period: sp.period, direction: sp.direction, page: sp.page });
  const canVoid = can(actor, "transactions.edit");
  const href = (over) => {
    const next = { period: data.period, direction: data.direction, page: 1, ...over };
    const params = new URLSearchParams();
    if (next.period !== "month") params.set("period", next.period);
    if (next.direction !== "all") params.set("direction", next.direction);
    if (next.page > 1) params.set("page", String(next.page));
    const s = params.toString();
    return s ? `/cashbook?${s}` : "/cashbook";
  };

  const summary = [
    { label: "Money in", value: data.totals.cashIn, icon: ArrowDownLeftIcon, tone: "text-success" },
    { label: "Money out", value: data.totals.cashOut, icon: ArrowUpRightIcon, tone: "text-warning-foreground dark:text-warning" },
    { label: "Net", value: data.totals.net, icon: ScaleIcon, tone: data.totals.net >= 0 ? "text-primary" : "text-destructive" },
    { label: "Cash in hand (all time)", value: data.cashInHand, icon: LandmarkIcon, tone: "text-primary", accent: true },
  ];

  return (
    <PageBody>
      <PageHeader
        icon={BookOpenIcon}
        title="Cash book"
        description="Every rupee in and out. Customer payments, seller payments and cash bike sales appear here automatically."
        actions={can(actor, "transactions.create") && <AddEntryDialog action={createTransactionAction} />}
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Tabs items={PERIODS.map((p) => ({ key: p.value, label: p.label }))} current={data.period} href={(k) => href({ period: k })} />
        <Tabs items={DIRECTIONS} current={data.direction} href={(k) => href({ direction: k })} />
      </div>

      <Card className="gap-0 overflow-hidden py-0">
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          {summary.map((s) => (
            <div key={s.label} className="relative bg-card px-5 py-4">
              {s.accent && <div className="absolute inset-x-0 top-0 h-0.5 bg-brand shadow-[0_0_10px_var(--brand)]" />}
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <s.icon className={cn("size-3.5", s.tone)} /> {s.label}
              </p>
              <p className={cn("mt-1 text-xl font-semibold tabular-nums sm:text-2xl", s.value < 0 && "text-destructive")}>
                <CountUp value={s.value} prefix="Rs " />
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="gap-0 overflow-hidden py-0">
        {data.items.length === 0 ? (
          <Empty className="py-14">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <BookOpenIcon />
              </EmptyMedia>
              <EmptyTitle>Nothing in this period</EmptyTitle>
              <EmptyDescription>Payments, bike sales, seller payments and the entries you add will be listed here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="pl-4">Date</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="text-right">In</TableHead>
                <TableHead className="text-right">Out</TableHead>
                {canVoid && <TableHead className="w-10 pr-4" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="pl-4 whitespace-nowrap text-muted-foreground">{formatBusinessDate(e.date)}</TableCell>
                  <TableCell className="max-w-[22rem]">
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
                  <TableCell className="text-right font-medium tabular-nums text-success">{e.direction === "in" ? formatPKR(e.amount) : ""}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{e.direction === "out" ? formatPKR(e.amount) : ""}</TableCell>
                  {canVoid && (
                    <TableCell className="pr-4 text-right">
                      {e.transactionId && <VoidEntryButton action={voidTransactionAction.bind(null, e.transactionId)} label={`${e.sourceLabel} of ${formatPKR(e.amount)}: ${e.title}`} />}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {data.total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row">
            <span>
              {formatNumber(data.total)} {data.total === 1 ? "entry" : "entries"} · {data.range.label.toLowerCase()}
            </span>
            {data.pageCount > 1 && (
              <nav className="flex items-center gap-2" aria-label="Pages">
                <Button variant="outline" size="sm" asChild={data.page > 1} disabled={data.page <= 1}>
                  {data.page > 1 ? (
                    <Link href={href({ page: data.page - 1 })}>
                      <ChevronLeftIcon /> Previous
                    </Link>
                  ) : (
                    <span>
                      <ChevronLeftIcon /> Previous
                    </span>
                  )}
                </Button>
                <span className="px-1 tabular-nums">
                  Page {data.page} of {data.pageCount}
                </span>
                <Button variant="outline" size="sm" asChild={data.page < data.pageCount} disabled={data.page >= data.pageCount}>
                  {data.page < data.pageCount ? (
                    <Link href={href({ page: data.page + 1 })}>
                      Next <ChevronRightIcon />
                    </Link>
                  ) : (
                    <span>
                      Next <ChevronRightIcon />
                    </span>
                  )}
                </Button>
              </nav>
            )}
          </div>
        )}
      </Card>
      <p className="text-xs text-muted-foreground">
        Cash in hand counts only what has been recorded in this system. Settlement discounts are not cash and are not shown here.
      </p>
    </PageBody>
  );
}
