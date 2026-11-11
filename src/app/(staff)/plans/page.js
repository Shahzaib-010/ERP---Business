import Link from "next/link";
import Form from "next/form";
import { Suspense } from "react";
import { ChevronLeftIcon, ChevronRightIcon, FilePlus2Icon, FileTextIcon, SearchIcon, SearchXIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PlanProgress, PlanStatusBadge } from "@/components/app/plan-ui";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { PLAN_PAGE_SIZE, listPlans } from "@/server/services/installments";
import { formatNumber, formatPKR } from "@/lib/format";
import { formatBusinessDate } from "@/lib/business-date";
import { cn } from "@/lib/utils";

export const metadata = { title: "Installment plans" };

const TABS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "late", label: "Late" },
  { key: "completed", label: "Completed" },
];

export default function PlansPage({ searchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PlansContent searchParams={searchParams} />
    </Suspense>
  );
}

async function PlansContent({ searchParams }) {
  const actor = await requireStaffPage("installments.view");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const { items, total, page, pageCount, status } = await listPlans(actor, { q, status: sp.status, page: sp.page });
  const canCreate = can(actor, "installments.create");

  const href = (over) => {
    const params = new URLSearchParams();
    const next = { q, status, page: 1, ...over };
    if (next.q) params.set("q", next.q);
    if (next.status && next.status !== "all") params.set("status", next.status);
    if (next.page > 1) params.set("page", String(next.page));
    const s = params.toString();
    return s ? `/plans?${s}` : "/plans";
  };
  const from = total === 0 ? 0 : (page - 1) * PLAN_PAGE_SIZE + 1;
  const to = Math.min(page * PLAN_PAGE_SIZE, total);

  return (
    <PageBody>
      <PageHeader
        icon={FileTextIcon}
        title="Installment plans"
        description="Every installment agreement, its payments and what is still owed."
        actions={
          canCreate && (
            <Button asChild>
              <Link href="/plans/new">
                <FilePlus2Icon /> New plan
              </Link>
            </Button>
          )
        }
      />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center lg:justify-between lg:p-4">
          <nav className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1" aria-label="Filter by status">
            {TABS.map((t) => (
              <Link
                key={t.key}
                href={href({ status: t.key })}
                aria-current={status === t.key ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1 text-sm whitespace-nowrap transition-colors",
                  status === t.key ? "bg-background font-medium shadow-xs" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </Link>
            ))}
          </nav>
          <Form action="/plans" className="flex w-full gap-2 lg:max-w-md">
            {status !== "all" && <input type="hidden" name="status" value={status} />}
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput name="q" defaultValue={q} placeholder="Account no., customer or item" aria-label="Search plans" />
            </InputGroup>
            <Button type="submit" variant="secondary">
              Search
            </Button>
            {q && (
              <Button variant="ghost" size="icon" asChild aria-label="Clear search">
                <Link href={href({ q: "" })}>
                  <XIcon />
                </Link>
              </Button>
            )}
          </Form>
        </div>

        {items.length === 0 ? (
          <Empty className="py-14">
            <EmptyHeader>
              <EmptyMedia variant="icon">{q ? <SearchXIcon /> : <FileTextIcon />}</EmptyMedia>
              <EmptyTitle>{q ? "No matching plans" : status === "late" ? "No late plans" : "No plans yet"}</EmptyTitle>
              <EmptyDescription>
                {q
                  ? `Nothing matches “${q}”.`
                  : status === "late"
                    ? "Every active plan is up to date."
                    : "Installment agreements you create will appear here."}
              </EmptyDescription>
            </EmptyHeader>
            {canCreate && !q && status === "all" && (
              <EmptyContent>
                <Button size="sm" asChild>
                  <Link href="/plans/new">
                    <FilePlus2Icon /> New plan
                  </Link>
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="pl-4">Account</TableHead>
                <TableHead>Customer &amp; item</TableHead>
                <TableHead className="hidden text-right md:table-cell">Total</TableHead>
                <TableHead className="hidden w-48 lg:table-cell">Paid</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="hidden pr-4 sm:table-cell">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((p) => (
                <TableRow key={p.id} className="group">
                  <TableCell className="pl-4">
                    <Link href={`/plans/${p.id}`} className="font-mono font-semibold tabular-nums group-hover:underline">
                      #{p.accountNumber}
                    </Link>
                    <p className="text-xs text-muted-foreground">{formatBusinessDate(p.agreementDate)}</p>
                  </TableCell>
                  <TableCell className="max-w-[16rem]">
                    <Link href={`/plans/${p.id}`} className="block truncate font-medium">
                      {p.customer?.name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">{p.item.description}</p>
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums md:table-cell">{formatPKR(p.agreedTotal)}</TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <div className="flex items-center gap-2">
                      <PlanProgress percent={p.percent} status={p.status} overdue={p.overdue} />
                      <span className="w-9 text-right text-xs tabular-nums text-muted-foreground">{p.percent}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatPKR(p.balance)}
                    <div className="sm:hidden">
                      <PlanStatusBadge status={p.status} overdue={p.overdue} className="mt-1" />
                    </div>
                  </TableCell>
                  <TableCell className="hidden pr-4 sm:table-cell">
                    <PlanStatusBadge status={p.status} overdue={p.overdue} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 text-sm text-muted-foreground sm:flex-row">
            <span className="tabular-nums">
              Showing {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
            </span>
            {pageCount > 1 && (
              <nav className="flex items-center gap-2" aria-label="Pages">
                <Button variant="outline" size="sm" asChild={page > 1} disabled={page <= 1}>
                  {page > 1 ? (
                    <Link href={href({ page: page - 1 })}>
                      <ChevronLeftIcon /> Previous
                    </Link>
                  ) : (
                    <span>
                      <ChevronLeftIcon /> Previous
                    </span>
                  )}
                </Button>
                <span className="px-1 tabular-nums">
                  Page {page} of {pageCount}
                </span>
                <Button variant="outline" size="sm" asChild={page < pageCount} disabled={page >= pageCount}>
                  {page < pageCount ? (
                    <Link href={href({ page: page + 1 })}>
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
    </PageBody>
  );
}
