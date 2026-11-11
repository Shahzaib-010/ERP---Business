import Link from "next/link";
import Form from "next/form";
import { Suspense } from "react";
import { Badge, ButtonLink, Card, LoadingBlock, PageHeader, buttonClass, inputClass } from "@/components/ui";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { listCustomers } from "@/server/services/customers";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "Customers" };

export default function CustomersPage({ searchParams }) {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <CustomersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CustomersContent({ searchParams }) {
  const actor = await requireStaffPage("customers.view");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const { items, total, page, pageCount } = await listCustomers(actor, { q, page: sp.page });

  const pageHref = (p) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (p > 1) params.set("page", String(p));
    const s = params.toString();
    return s ? `/customers?${s}` : "/customers";
  };

  return (
    <>
      <PageHeader
        title="Customers"
        description={q ? `${total} found for “${q}”` : `${total} customer${total === 1 ? "" : "s"}`}
        action={can(actor, "customers.create") && <ButtonLink href="/customers/new">Add customer</ButtonLink>}
      />

      <Form action="/customers" className="mb-4 flex max-w-xl gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Name, CNIC or phone"
          aria-label="Search customers"
          className={inputClass}
        />
        <button type="submit" className={buttonClass("secondary")}>
          Search
        </button>
        {q && (
          <Link href="/customers" className={buttonClass("secondary")}>
            Clear
          </Link>
        )}
      </Form>

      {items.length === 0 ? (
        <Card>
          <p className="text-sm text-slate-600">
            {q ? "No customer matches that search." : "No customers yet."}
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto p-0">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2 font-medium">Name</th>
                <th className="px-4 py-2 font-medium">Father / husband</th>
                <th className="px-4 py-2 font-medium">CNIC</th>
                <th className="px-4 py-2 font-medium">Phone</th>
                <th className="px-4 py-2 font-medium">Portal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2">
                    <Link href={`/customers/${c.id}`} className="font-medium underline-offset-2 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-slate-600">{c.fatherOrHusbandName || "—"}</td>
                  <td className="px-4 py-2 font-mono text-xs">{c.cnicMasked}</td>
                  <td className="px-4 py-2 font-mono text-xs">{c.phones[0] ? formatPhone(c.phones[0]) : "—"}</td>
                  <td className="px-4 py-2">{c.portalEnabled ? <Badge tone="green">On</Badge> : <Badge>Off</Badge>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {pageCount > 1 && (
        <nav className="mt-4 flex items-center gap-3 text-sm" aria-label="Pages">
          {page > 1 && (
            <Link href={pageHref(page - 1)} className={buttonClass("secondary")}>
              Previous
            </Link>
          )}
          <span className="text-slate-600">
            Page {page} of {pageCount}
          </span>
          {page < pageCount && (
            <Link href={pageHref(page + 1)} className={buttonClass("secondary")}>
              Next
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
