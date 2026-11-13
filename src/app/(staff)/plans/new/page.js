import { Suspense } from "react";
import { FilePlus2Icon } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { getCustomer } from "@/server/services/customers";
import { getNextNumbers } from "@/server/services/installments";
import { getBikeForSale } from "@/server/services/bikes";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  const { customerId, bikeId } = await searchParams;
  // The three lookups are independent, so they run together.
  const [nextNumbers, c, foundBike] = await Promise.all([
    getNextNumbers(actor),
    // Coming from a customer's profile: start with that customer selected.
    typeof customerId === "string" && can(actor, "customers.view") ? getCustomer(actor, customerId).catch(() => null) : null,
    // Coming from a bike's page: sell that bike on installments.
    typeof bikeId === "string" && can(actor, "bikes.view") ? getBikeForSale(actor, bikeId).catch(() => null) : null,
  ]);
  const initialCustomer = c ? { id: c.id, name: c.name, cnicMasked: c.cnicMasked, phones: c.phones } : null;

  let bike = foundBike;
  let bikeProblem = null;
  if (bike && bike.status !== "in_stock") {
    bikeProblem = `B-${bike.bikeNumber} has already been sold.`;
    bike = null;
  }

  return (
    <PageBody className="mx-auto w-full max-w-5xl">
      {bikeProblem && (
        <Alert variant="destructive">
          <AlertDescription>{bikeProblem}</AlertDescription>
        </Alert>
      )}
      <PageHeader icon={FilePlus2Icon} title="New installment plan" description="Copy the details from the agreement form. Fields marked * are required." />
      <PlanForm action={createPlanAction} initialCustomer={initialCustomer} nextNumbers={nextNumbers} bike={bike} />
    </PageBody>
  );
}
