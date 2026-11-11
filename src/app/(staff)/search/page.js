import Link from "next/link";
import Form from "next/form";
import { Suspense } from "react";
import { Card, LoadingBlock, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { requireStaffPage } from "@/server/auth/current";
import { universalSearch } from "@/server/services/search";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "Search" };

export default function SearchPage({ searchParams }) {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <SearchContent searchParams={searchParams} />
    </Suspense>
  );
}

async function SearchContent({ searchParams }) {
  const actor = await requireStaffPage();
  const sp = await searchParams;
  const { q, groups, searchable } = await universalSearch(actor, typeof sp.q === "string" ? sp.q : "");
  const hint = searchable.length ? `Search by ${searchable.join("; ")}.` : "You have no modules you can search.";
  const found = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <>
      <PageHeader title="Search" description={hint} />

      <Form action="/search" className="mb-6 flex max-w-xl gap-2">
        <input name="q" defaultValue={q} aria-label="Search" placeholder="Type and press Enter" className={inputClass} autoFocus />
        <button type="submit" className={buttonClass("secondary")}>
          Search
        </button>
      </Form>

      {q && found === 0 && (
        <Card>
          <p className="text-sm text-slate-600">Nothing found for “{q}”.</p>
        </Card>
      )}

      <div className="space-y-6">
        {groups
          .filter((g) => g.items.length > 0)
          .map((g) => (
            <section key={g.type}>
              <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                {g.label} ({g.items.length})
              </h2>
              <Card className="divide-y divide-slate-100 p-0">
                {g.type === "customers" &&
                  g.items.map((c) => (
                    <Link key={c.id} href={`/customers/${c.id}`} className="block px-4 py-3 hover:bg-slate-50">
                      <span className="font-medium">{c.name}</span>
                      {c.fatherOrHusbandName && <span className="text-slate-500"> · {c.fatherOrHusbandName}</span>}
                      <span className="mt-0.5 block font-mono text-xs text-slate-500">
                        {c.cnicMasked}
                        {c.phones[0] && ` · ${formatPhone(c.phones[0])}`}
                      </span>
                    </Link>
                  ))}
              </Card>
              {g.type === "customers" && g.items.length === 20 && (
                <p className="mt-2 text-xs text-slate-500">
                  Showing the first 20.{" "}
                  <Link href={`/customers?q=${encodeURIComponent(q)}`} className="underline">
                    See all matching customers
                  </Link>
                </p>
              )}
            </section>
          ))}
      </div>
    </>
  );
}
