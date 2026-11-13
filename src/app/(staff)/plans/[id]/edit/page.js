import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { PencilIcon } from "lucide-react";
import { BreadcrumbLabel } from "@/components/app/breadcrumbs";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { getPlan } from "@/server/services/installments";
import { NotFoundError } from "@/server/errors";
import { formatPhone } from "@/lib/phone";
import { updatePlanDetailsAction } from "../../actions";
import { PlanDetailsForm } from "./plan-details-form";

export const metadata = { title: "Edit plan" };

export default function EditPlanPage({ params }) {
  return (
    <Suspense fallback={<PageSkeleton variant="form" />}>
      <EditPlanContent params={params} />
    </Suspense>
  );
}

async function EditPlanContent({ params }) {
  const actor = await requireStaffPage("installments.view");
  if (!can(actor, "installments.edit")) redirect("/no-access");
  const { id } = await params;
  let plan;
  try {
    plan = await getPlan(actor, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  // Guarantor CNICs are only shown masked, so the form does not pre-fill them; leaving the
  // field empty keeps the saved CNIC (see updatePlanDetails).
  const initial = {
    previousAccountNumber: plan.previousAccountNumber ?? "",
    itemKind: plan.item.kind,
    itemDescription: plan.item.description,
    itemModel: plan.item.model,
    itemSerial: plan.item.serialNumber,
    itemCost: plan.profit.costSource === "plan" ? (plan.profit.cost ?? "") : "",
    notes: plan.notes,
    guarantors: plan.guarantors.map((g) => ({
      name: g.name,
      fatherName: g.fatherName,
      cnic: "",
      cnicMasked: g.cnicMasked,
      phone: g.phones[0] ? formatPhone(g.phones[0]) : "",
      profession: g.profession,
      address: g.address,
    })),
  };

  return (
    <PageBody className="mx-auto w-full max-w-5xl">
      <BreadcrumbLabel segment={plan.id} label={`#${plan.accountNumber}`} />
      <PageHeader
        icon={PencilIcon}
        title={`Edit plan #${plan.accountNumber}`}
        description="Item, cost, guarantors and notes. Prices and payments cannot be changed here; the schedule is changed from the plan page."
      />
      <PlanDetailsForm
        action={updatePlanDetailsAction.bind(null, plan.id)}
        initial={initial}
        cancelHref={`/plans/${plan.id}`}
        cost={{ fromBike: plan.profit.costSource === "bike", bikeCost: plan.profit.cost, agreedTotal: plan.terms.agreedTotal, paidAmount: plan.profit.paidFromCash?.amount ?? null }}
      />
    </PageBody>
  );
}
