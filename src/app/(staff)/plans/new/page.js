import { Suspense } from "react";
import { FilePlus2Icon } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { getCustomer } from "@/server/services/customers";
import { getNextNumbers } from "@/server/services/installments";
import { createPlanAction } from "../actions";
import { PlanForm } from "../plan-form";

export const metadata = { title: "New installment plan" };

export default function NewPlanPage({ searchParams }) {
  return (
    <Suspense fallback={<PageSkeleton variant="form" />}>
      <NewPlanContent searchParams={searchParams} />
    </Suspense>
  );
}

async function NewPlanContent({ searchParams }) {
  const actor = await requireStaffPage("installments.create");
  const { customerId } = await searchParams;
  const nextNumbers = await getNextNumbers(actor);

  // Coming from a customer's profile: start with that customer selected.
  let initialCustomer = null;
  if (typeof customerId === "string" && can(actor, "customers.view")) {
    try {
      const c = await getCustomer(actor, customerId);
      initialCustomer = { id: c.id, name: c.name, cnicMasked: c.cnicMasked, phones: c.phones };
    } catch {
      initialCustomer = null;
    }
  }

  return (
    <PageBody className="mx-auto w-full max-w-5xl">
      <PageHeader icon={FilePlus2Icon} title="New installment plan" description="Copy the details from the agreement form. Fields marked * are required." />
      <PlanForm action={createPlanAction} initialCustomer={initialCustomer} nextNumbers={nextNumbers} />
    </PageBody>
  );
}
