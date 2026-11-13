import Link from "next/link";
import Form from "next/form";
import { Suspense } from "react";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  EyeIcon,
  FileSpreadsheetIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SearchIcon,
  SearchXIcon,
  UserPlusIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { CUSTOMER_PAGE_SIZE, listCustomers } from "@/server/services/customers";
import { formatDate, formatNumber, initials } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "Customers" };

export default function CustomersPage({ searchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CustomersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CustomersContent({ searchParams }) {
  const actor = await requireStaffPage("customers.view");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const { items, total, page, pageCount } = await listCustomers(actor, { q, page: sp.page });
  const canCreate = can(actor, "customers.create");
  const canEdit = can(actor, "customers.edit");

  const pageHref = (p) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/customers?${s}` : "/customers";
  };
  const from = total === 0 ? 0 : (page - 1) * CUSTOMER_PAGE_SIZE + 1;
  const to = Math.min(page * CUSTOMER_PAGE_SIZE, total);

  return (
    <PageBody>
      <PageHeader
        icon={UsersIcon}
        title="Customers"
        description="Everyone who has bought from the showroom or taken an installment plan."
        actions={
          canCreate && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" asChild>
                <Link href="/customers/import">
                  <FileSpreadsheetIcon /> Import
                </Link>
              </Button>
              <Button asChild>
                <Link href="/customers/new">
                  <UserPlusIcon /> Add customer
                </Link>
              </Button>
            </div>
          )
        }
      />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-3 border-b p-3 sm:flex-row sm:items-center sm:justify-between sm:p-4">
          <Form action="/customers" className="flex w-full max-w-md gap-2">
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon />
              </InputGroupAddon>
              <InputGroupInput name="q" defaultValue={q} placeholder="Search name, CNIC or phone" aria-label="Search customers" />
            </InputGroup>
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </Form>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {q && (
              <Button variant="ghost" size="sm" asChild>
                <Link href="/customers">
                  <XIcon /> Clear search
                </Link>
              </Button>
            )}
            <span className="tabular-nums">
              {formatNumber(total)} {q ? "found" : total === 1 ? "customer" : "customers"}
            </span>
          </div>
        </div>

        {items.length === 0 ? (
          <Empty className="py-14">
            <EmptyHeader>
              <EmptyMedia variant="icon">{q ? <SearchXIcon /> : <UsersIcon />}</EmptyMedia>
              <EmptyTitle>{q ? "No matching customers" : "No customers yet"}</EmptyTitle>
              <EmptyDescription>
                {q ? `Nothing matches “${q}”. Check the spelling, or search by CNIC or phone.` : "Customers you add will appear here."}
              </EmptyDescription>
            </EmptyHeader>
            <EmptyContent className="flex-row justify-center">
              {q && (
                <Button variant="outline" size="sm" asChild>
                  <Link href="/customers">Clear search</Link>
                </Button>
              )}
              {canCreate && (
                <Button size="sm" asChild>
                  <Link href="/customers/new">
                    <UserPlusIcon /> Add customer
                  </Link>
                </Button>
              )}
            </EmptyContent>
          </Empty>
        ) : (
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="pl-4">Customer</TableHead>
                <TableHead className="hidden md:table-cell">CNIC</TableHead>
                <TableHead className="hidden sm:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Portal</TableHead>
                <TableHead className="hidden lg:table-cell">Added</TableHead>
                <TableHead className="w-12 pr-4">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((c) => (
                <TableRow key={c.id} className="group">
                  <TableCell className="pl-4">
                    <Link href={`/customers/${c.id}`} className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(c.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        <p className="truncate font-medium group-hover:text-primary">{c.name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {c.fatherOrHusbandName ? `Father / husband: ${c.fatherOrHusbandName}` : <span className="font-mono md:hidden">{c.cnicMasked}</span>}
                        </p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden font-mono text-xs md:table-cell">{c.cnicMasked}</TableCell>
                  <TableCell className="hidden font-mono text-xs sm:table-cell">
                    {c.phones[0] ? formatPhone(c.phones[0]) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    {c.portalEnabled ? (
                      <Badge variant="secondary" className="bg-success/10 text-success">
                        On
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        Off
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground lg:table-cell">{formatDate(c.createdAt)}</TableCell>
                  <TableCell className="pr-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${c.name}`}>
                          <MoreHorizontalIcon />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/customers/${c.id}`}>
                            <EyeIcon /> View profile
                          </Link>
                        </DropdownMenuItem>
                        {canEdit && (
                          <DropdownMenuItem asChild>
                            <Link href={`/customers/${c.id}/edit`}>
                              <PencilIcon /> Edit
                            </Link>
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
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
                    <Link href={pageHref(page - 1)}>
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
                    <Link href={pageHref(page + 1)}>
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
