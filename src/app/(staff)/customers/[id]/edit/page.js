import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Card, LoadingBlock, PageHeader } from "@/components/ui";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { getCustomer } from "@/server/services/customers";
import { NotFoundError } from "@/server/errors";
import { updateCustomerAction } from "../../actions";
import { CustomerForm } from "../../customer-form";
import { formatPhone } from "@/lib/phone";

export const metadata = { title: "Edit customer" };

export default function EditCustomerPage({ params }) {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <EditCustomerContent params={params} />
    </Suspense>
  );
}

async function EditCustomerContent({ params }) {
  const actor = await requireStaffPage("customers.view");
  if (!can(actor, "customers.edit")) redirect("/no-access");
  const { id } = await params;

  let customer;
  try {
    customer = await getCustomer(actor, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return (
    <>
      <PageHeader title={`Edit ${customer.name}`} description="Fields marked * are required." />
      <Card>
        <CustomerForm
          action={updateCustomerAction.bind(null, customer.id)}
          customer={{ ...customer, phones: customer.phones.map(formatPhone) }}
          cancelHref={`/customers/${customer.id}`}
        />
      </Card>
    </>
  );
}
