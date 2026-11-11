import { Suspense } from "react";
import { BikeIcon } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { getNextBikeNumber } from "@/server/services/bikes";
import { createBikeAction } from "../actions";
import { BikeForm } from "../bike-form";

export const metadata = { title: "Add bike purchase" };

export default function NewBikePage() {
  return (
    <Suspense fallback={<PageSkeleton variant="form" />}>
      <NewBikeContent />
    </Suspense>
  );
}

async function NewBikeContent() {
  const actor = await requireStaffPage("bikes.create");
  const nextBikeNumber = await getNextBikeNumber(actor);
  return (
    <PageBody className="mx-auto w-full max-w-5xl">
      <PageHeader icon={BikeIcon} title="Add bike purchase" description="A bike the showroom has bought. Fields marked * are required." />
      <BikeForm action={createBikeAction} cancelHref="/bikes" nextBikeNumber={nextBikeNumber} />
    </PageBody>
  );
}
