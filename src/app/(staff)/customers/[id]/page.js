import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Alert, Badge, ButtonLink, Card, LoadingBlock, PageHeader } from "@/components/ui";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { getCustomer } from "@/server/services/customers";
import { NotFoundError } from "@/server/errors";
import { formatPhone } from "@/lib/phone";
import { disablePortalAction, setPortalPasswordAction } from "../actions";
import { PortalAccess } from "./portal-access";

export const metadata = { title: "Customer" };

const dateFmt = new Intl.DateTimeFormat("en-PK", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Karachi",
});

const SAVED_MESSAGES = {
  created: "Customer added.",
  updated: "Changes saved.",
  unchanged: "Nothing was changed.",
};

export default function CustomerPage({ params, searchParams }) {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <CustomerContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

function Detail({ label, children }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-sm text-slate-900">{children || "—"}</dd>
    </div>
  );
}

async function CustomerContent({ params, searchParams }) {
  const actor = await requireStaffPage("customers.view");
  const { id } = await params;
  const { saved } = await searchParams;

  let c;
  try {
    c = await getCustomer(actor, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const canEdit = can(actor, "customers.edit");

  return (
    <>
      <PageHeader
        title={c.name}
        description={c.fatherOrHusbandName ? `Father / husband: ${c.fatherOrHusbandName}` : undefined}
        action={canEdit && <ButtonLink href={`/customers/${c.id}/edit`} variant="secondary">Edit</ButtonLink>}
      />

      <div className="space-y-6">
        {SAVED_MESSAGES[saved] && <Alert tone="success">{SAVED_MESSAGES[saved]}</Alert>}

        <Card>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Detail label="CNIC">
              <span className="font-mono">{c.cnic}</span>
            </Detail>
            <Detail label="Phone numbers">
              {c.phones.length > 0 && <span className="font-mono">{c.phones.map(formatPhone).join("\n")}</span>}
            </Detail>
            <Detail label="Profession">{c.profession}</Detail>
            <Detail label="Designation">{c.designation}</Detail>
            <Detail label="Caste / tribe">{c.caste}</Detail>
            <Detail label="Added">{c.createdAt ? dateFmt.format(c.createdAt) : ""}</Detail>
            <Detail label="Home address">{c.homeAddress}</Detail>
            <Detail label="Installment collection address">{c.collectionAddress}</Detail>
            <Detail label="Business / office address">{c.businessAddress}</Detail>
          </dl>
          {c.notes && (
            <dl className="mt-4 border-t border-slate-100 pt-4">
              <Detail label="Notes">{c.notes}</Detail>
            </dl>
          )}
        </Card>

        <Card>
          <h2 className="mb-1 font-medium">Installment plans and bikes</h2>
          <p className="text-sm text-slate-600">
            This customer&apos;s plans, bikes, payments and receipts will be listed here once
            those modules are built (Phases 3–6).
          </p>
        </Card>

        <Card className="max-w-xl">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="font-medium">Customer portal login</h2>
            {c.portal.enabled ? <Badge tone="green">On</Badge> : <Badge>Off</Badge>}
          </div>
          <p className="mb-4 text-sm text-slate-600">
            The customer logs in with their CNIC and this password to see their own plans and
            payments. Check their CNIC card before setting a password.
            {c.portal.lastLoginAt && ` Last login: ${dateFmt.format(c.portal.lastLoginAt)}.`}
          </p>
          {canEdit ? (
            <PortalAccess
              enabled={c.portal.enabled}
              setPasswordAction={setPortalPasswordAction.bind(null, c.id)}
              disableAction={disablePortalAction.bind(null, c.id)}
            />
          ) : (
            <p className="text-sm text-slate-500">You need the “Edit customers” permission to change this.</p>
          )}
        </Card>
      </div>
    </>
  );
}
