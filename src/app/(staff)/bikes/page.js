import Link from "next/link";
import Form from "next/form";
import { Suspense } from "react";
import { BikeIcon, ChevronLeftIcon, ChevronRightIcon, PlusIcon, SearchIcon, SearchXIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BikeStatusBadge, ConditionBadge, bikeNo } from "@/components/app/bike-ui";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { BIKE_PAGE_SIZE, listBikes } from "@/server/services/bikes";
import { formatBusinessDate } from "@/lib/business-date";
import { formatNumber, formatPKR } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Bikes" };

const TABS = [
  { key: "in_stock", label: "In stock" },
  { key: "owed", label: "Owed to seller" },
  { key: "sold", label: "Sold" },
  { key: "all", label: "All" },
];

export default function BikesPage({ searchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BikesContent searchParams={searchParams} />
    </Suspense>
  );
}

async function BikesContent({ searchParams }) {
  const actor = await requireStaffPage("bikes.view");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const { items, total, page, pageCount, status } = await listBikes(actor, { q, status: sp.status, page: sp.page });
  const canCreate = can(actor, "bikes.create");

  const href = (over) => {
    const params = new URLSearchParams();
    const next = { q, status, page: 1, ...over };
    if (next.q) params.set("q", next.q);
    if (next.status && next.status !== "in_stock") params.set("status", next.status);
    if (next.page > 1) params.set("page", String(next.page));
    const s = params.toString();
    return s ? `/bikes?${s}` : "/bikes";
  };
  const from = total === 0 ? 0 : (page - 1) * BIKE_PAGE_SIZE + 1;
  const to = Math.min(page * BIKE_PAGE_SIZE, total);

  return (
    <PageBody>
      <PageHeader
        icon={BikeIcon}
        title="Bikes"
        description="The showroom register: every bike bought, what is owed to sellers, and who it was sold to."
        actions={
          canCreate && (
            <Button asChild>
              <Link href="/bikes/new">
                <PlusIcon /> Add bike purchase
              </Link>
            </Button>
          )
        }
      />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-3 border-b p-3 lg:flex-row lg:items-center lg:justify-between lg:p-4">
          <nav className="flex gap-1 overflow-x-auto rounded-lg bg-muted p-1" aria-label="Filter">
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
          <Form action="/bikes" className="flex w-full gap-2 lg:max-w-md">
            {status !== "in_stock" && <input type="hidden" name="status" value={status} />}
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput name="q" defaultValue={q} placeholder="Make, model, reg., engine, seller, B-12" aria-label="Search bikes" />
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
              <EmptyMedia variant="icon">{q ? <SearchXIcon /> : <BikeIcon />}</EmptyMedia>
              <EmptyTitle>{q ? "No matching bikes" : status === "owed" ? "Nothing owed to sellers" : status === "sold" ? "No bikes sold yet" : "No bikes in stock"}</EmptyTitle>
              <EmptyDescription>{q ? `Nothing matches “${q}”.` : "Bikes you buy are added here, then moved to Sold when you sell them."}</EmptyDescription>
            </EmptyHeader>
            {canCreate && !q && (
              <EmptyContent>
                <Button size="sm" asChild>
                  <Link href="/bikes/new">
                    <PlusIcon /> Add bike purchase
                  </Link>
                </Button>
              </EmptyContent>
            )}
          </Empty>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="pl-4">Stock</TableHead>
                <TableHead>Bike</TableHead>
                <TableHead className="hidden md:table-cell">Reg. / engine</TableHead>
                <TableHead className="hidden text-right lg:table-cell">Bought for</TableHead>
                <TableHead className="hidden text-right sm:table-cell">Owed to seller</TableHead>
                <TableHead className="pr-4">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((b) => (
                <TableRow key={b.id} className="group">
                  <TableCell className="pl-4">
                    <Link href={`/bikes/${b.id}`} className="font-mono font-semibold group-hover:underline">
                      {bikeNo(b.bikeNumber)}
                    </Link>
                    <p className="text-xs text-muted-foreground">{formatBusinessDate(b.purchaseDate)}</p>
                  </TableCell>
                  <TableCell className="max-w-[16rem]">
                    <Link href={`/bikes/${b.id}`} className="flex items-center gap-2">
                      <span className="truncate font-medium">{b.label}</span>
                      <ConditionBadge condition={b.condition} />
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">from {b.sellerName}</p>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs md:table-cell">
                    {b.registrationNumber || "—"}
                    {b.engineNumber && <p className="text-muted-foreground">{b.engineNumber}</p>}
                  </TableCell>
                  <TableCell className="hidden text-right tabular-nums lg:table-cell">{formatPKR(b.purchasePrice)}</TableCell>
                  <TableCell className={cn("hidden text-right tabular-nums sm:table-cell", b.payable > 0 ? "font-medium" : "text-muted-foreground")}>
                    {b.payable > 0 ? formatPKR(b.payable) : "—"}
                  </TableCell>
                  <TableCell className="pr-4">
                    <BikeStatusBadge status={b.status} />
                    {b.sale?.customer && (
                      <Link href={`/customers/${b.sale.customer.id}`} className="mt-1 block max-w-[10rem] truncate text-xs text-muted-foreground hover:underline">
                        to {b.sale.customer.name}
                      </Link>
                    )}
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
