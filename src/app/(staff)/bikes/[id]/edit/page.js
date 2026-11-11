import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { PencilIcon } from "lucide-react";
import { BreadcrumbLabel } from "@/components/app/breadcrumbs";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { getBike } from "@/server/services/bikes";
import { NotFoundError } from "@/server/errors";
import { formatPhone } from "@/lib/phone";
import { updateBikeAction } from "../../actions";
import { BikeForm } from "../../bike-form";

export const metadata = { title: "Edit bike" };

export default function EditBikePage({ params }) {
  return (
    <Suspense fallback={<PageSkeleton variant="form" />}>
      <EditBikeContent params={params} />
    </Suspense>
  );
}

async function EditBikeContent({ params }) {
  const actor = await requireStaffPage("bikes.view");
  if (!can(actor, "bikes.edit")) redirect("/no-access");
  const { id } = await params;
  let b;
  try {
    b = await getBike(actor, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const initial = {
    make: b.make,
    model: b.model,
    modelYear: b.modelYear ?? "",
    color: b.color,
    condition: b.condition,
    registrationNumber: b.registrationNumber,
    engineNumber: b.engineNumber,
    chassisNumber: b.chassisNumber,
    notes: b.notes,
    sellerName: b.seller.name,
    sellerPhone: b.seller.phone ? formatPhone(b.seller.phone) : "",
    sellerCnic: "",
    sellerCnicMasked: b.seller.cnicMasked,
    sellerAddress: b.seller.address,
  };
  return (
    <PageBody className="mx-auto w-full max-w-5xl">
      <BreadcrumbLabel segment={b.id} label={`B-${b.bikeNumber}`} />
      <PageHeader icon={PencilIcon} title={`Edit B-${b.bikeNumber}`} description="Bike and seller details. The purchase price and payments are not changed here." />
      <BikeForm action={updateBikeAction.bind(null, b.id)} bike={initial} cancelHref={`/bikes/${b.id}`} />
    </PageBody>
  );
}
