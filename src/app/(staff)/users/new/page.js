import { Suspense } from "react";
import { Card, LoadingBlock, PageHeader } from "@/components/ui";
import { requireStaffPage } from "@/server/auth/current";
import { createStaffAction } from "../actions";
import { StaffForm } from "../staff-form";

export const metadata = { title: "Add staff account" };

export default function NewStaffPage() {
  return (
    <>
      <PageHeader title="Add staff account" />
      <Suspense fallback={<LoadingBlock />}>
        <NewStaffContent />
      </Suspense>
    </>
  );
}

async function NewStaffContent() {
  await requireStaffPage("users.manage");
  return (
    <Card>
      <StaffForm action={createStaffAction} />
    </Card>
  );
}
