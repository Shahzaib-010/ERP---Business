import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { PencilIcon } from "lucide-react";
import { BreadcrumbLabel } from "@/components/app/breadcrumbs";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { getCustomer } from "@/server/services/customers";
import { NotFoundError } from "@/server/errors";
import { formatPhone } from "@/lib/phone";
import { updateCustomerAction } from "../../actions";
import { CustomerForm } from "../../customer-form";

export const metadata = { title: "Edit customer" };

export default function EditCustomerPage({ params }) {
  return (
    <Suspense fallback={<PageSkeleton variant="form" />}>
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
    <PageBody className="mx-auto w-full max-w-4xl">
      <BreadcrumbLabel segment={customer.id} label={customer.name} />
      <PageHeader icon={PencilIcon} title={`Edit ${customer.name}`} description="Changes are saved to the customer's history." />
      <CustomerForm
        action={updateCustomerAction.bind(null, customer.id)}
        customer={{ ...customer, phones: customer.phones.map(formatPhone), whatsapp: formatPhone(customer.whatsapp) }}
        cancelHref={`/customers/${customer.id}`}
      />
    </PageBody>
  );
}
