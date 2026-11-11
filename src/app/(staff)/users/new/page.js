import { Suspense } from "react";
import { UserPlusIcon } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { createStaffAction } from "../actions";
import { StaffForm } from "../staff-form";

export const metadata = { title: "Add staff account" };

export default function NewStaffPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="form" />}>
      <NewStaffContent />
    </Suspense>
  );
}

async function NewStaffContent() {
  await requireStaffPage("users.manage");
  return (
    <PageBody className="mx-auto w-full max-w-4xl">
      <PageHeader icon={UserPlusIcon} title="Add staff account" description="Create a sign-in for an Admin or a User." />
      <StaffForm action={createStaffAction} />
    </PageBody>
  );
}
