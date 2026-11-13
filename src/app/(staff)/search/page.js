import Link from "next/link";
import Form from "next/form";
import { Suspense } from "react";
import { ArrowRightIcon, BikeIcon, FileTextIcon, SearchIcon, SearchXIcon, UsersIcon } from "lucide-react";
import { PlanStatusBadge } from "@/components/app/plan-ui";
import { BikeStatusBadge } from "@/components/app/bike-ui";
import { formatPKR } from "@/lib/format";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { recentCustomers } from "@/server/services/customers";
import { universalSearch } from "@/server/services/search";
import { initials } from "@/lib/format";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "Search" };

const GROUP_ICONS = { customers: UsersIcon, plans: FileTextIcon, bikes: BikeIcon };
const RESULT_LIMIT = 20;

function CustomerRow({ c }) {
  return (
    <li>
      <Link href={`/customers/${c.id}`} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
        <Avatar className="size-9">
          <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(c.name)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium group-hover:text-primary">
            {c.name}
            {c.fatherOrHusbandName && <span className="font-normal text-muted-foreground"> · {c.fatherOrHusbandName}</span>}
          </p>
          <p className="truncate font-mono text-xs text-muted-foreground">
            {c.cnicMasked}
            {c.phones[0] && ` · ${formatPhone(c.phones[0])}`}
          </p>
        </div>
        <ArrowRightIcon className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </Link>
    </li>
  );
}

export default function SearchPage({ searchParams }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SearchContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SearchContent({ searchParams }) {
  const actor = await requireStaffPage();
  const sp = await searchParams;
  const { q, groups, searchable } = await universalSearch(actor, typeof sp.q === "string" ? sp.q : "");
  const found = groups.reduce((n, g) => n + g.items.length, 0);
  const newest = !q && can(actor, "customers.view") ? await recentCustomers(actor, { limit: 4 }) : [];

  return (
    <PageBody className="mx-auto w-full max-w-4xl">
      <PageHeader
        icon={SearchIcon}
        title="Search"
        description={searchable.length ? `Find records by ${searchable.join("; ")}.` : "Your account has no modules you can search."}
      />

      <Form action="/search" className="flex gap-2">
        <InputGroup className="h-11 bg-card">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput name="q" defaultValue={q} aria-label="Search" placeholder="Type a name, CNIC or phone number…" autoFocus className="text-base" />
          <InputGroupAddon align="inline-end" className="hidden sm:flex">
            <Kbd>Enter</Kbd>
          </InputGroupAddon>
        </InputGroup>
        <Button type="submit" size="lg" className="h-11">
          Search
        </Button>
      </Form>

      {!q && newest.length > 0 && (
        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row items-center justify-between border-b py-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <UsersIcon className="size-4 text-primary" /> Newest customers
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/customers">
                All customers <ArrowRightIcon />
              </Link>
            </Button>
          </CardHeader>
          <ul className="divide-y">
            {newest.map((c) => (
              <CustomerRow key={c.id} c={c} />
            ))}
          </ul>
        </Card>
      )}

      {!q && newest.length === 0 && (
        <Card>
          <CardContent>
            <Empty className="py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchIcon />
                </EmptyMedia>
                <EmptyTitle>Search the whole business</EmptyTitle>
                <EmptyDescription>
                  Tip: press <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> anywhere to search without leaving the page.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      )}

      {q && found === 0 && (
        <Card>
          <CardContent>
            <Empty className="py-10">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchXIcon />
                </EmptyMedia>
                <EmptyTitle>No results for “{q}”</EmptyTitle>
                <EmptyDescription>Check the spelling, try fewer words, or search by CNIC or phone number.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      )}

      {groups
        .filter((g) => g.items.length > 0)
        .map((g) => {
          const Icon = GROUP_ICONS[g.type] ?? SearchIcon;
          return (
            <Card key={g.type} className="gap-0 py-0">
              <CardHeader className="flex flex-row items-center justify-between border-b py-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Icon className="size-4 text-primary" /> {g.label}
                  <Badge variant="secondary" className="tabular-nums">
                    {g.items.length}
                    {g.items.length === RESULT_LIMIT && "+"}
                  </Badge>
                </CardTitle>
                {g.type === "customers" && g.items.length === RESULT_LIMIT && (
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/customers?q=${encodeURIComponent(q)}`}>
                      See all <ArrowRightIcon />
                    </Link>
                  </Button>
                )}
              </CardHeader>
              <ul className="divide-y">
                {g.type === "bikes" &&
                  g.items.map((bk) => (
                    <li key={bk.id}>
                      <Link href={`/bikes/${bk.id}`} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                        <span className="w-16 shrink-0 font-mono text-sm font-semibold">B-{bk.bikeNumber}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium group-hover:underline">{bk.label}</p>
                          <p className="truncate font-mono text-xs text-muted-foreground">{[bk.registrationNumber, bk.engineNumber].filter(Boolean).join(" · ") || "—"}</p>
                        </div>
                        <BikeStatusBadge status={bk.status} />
                      </Link>
                    </li>
                  ))}
                {g.type === "plans" &&
                  g.items.map((pl) => (
                    <li key={pl.id}>
                      <Link href={`/plans/${pl.id}`} className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50">
                        <span className="w-16 shrink-0 font-mono text-sm font-semibold">#{pl.accountNumber}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium group-hover:underline">{pl.customer?.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {pl.item.description} · balance {formatPKR(pl.balance)}
                          </p>
                        </div>
                        <PlanStatusBadge status={pl.status} overdue={pl.overdue} />
                      </Link>
                    </li>
                  ))}
                {g.type === "customers" && g.items.map((c) => <CustomerRow key={c.id} c={c} />)}
              </ul>
            </Card>
          );
        })}
    </PageBody>
  );
}
