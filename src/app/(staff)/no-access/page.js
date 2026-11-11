import { Suspense } from "react";
import { ButtonLink, Card, LoadingBlock, PageHeader } from "@/components/ui";
import { requireStaffPage } from "@/server/auth/current";

export const metadata = { title: "No access" };

export default function NoAccessPage() {
  return (
    <>
      <PageHeader title="No access" />
      <Suspense fallback={<LoadingBlock />}>
        <NoAccessContent />
      </Suspense>
    </>
  );
}

async function NoAccessContent() {
  await requireStaffPage();
  return (
    <Card className="space-y-4">
      <p className="text-sm text-slate-700">
        Your account does not have permission to open that page. Ask the Superadmin if you need
        it.
      </p>
      <ButtonLink href="/dashboard" variant="secondary">
        Back to dashboard
      </ButtonLink>
    </Card>
  );
}
