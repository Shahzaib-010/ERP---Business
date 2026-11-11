import { Suspense } from "react";
import { Card, LoadingBlock, PageHeader } from "@/components/ui";
import { requireStaffPage } from "@/server/auth/current";

export const metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <>
      <PageHeader title="Dashboard" />
      <Suspense fallback={<LoadingBlock />}>
        <DashboardContent />
      </Suspense>
    </>
  );
}

async function DashboardContent() {
  const actor = await requireStaffPage();
  return (
    <Card>
      <p className="mb-2 font-medium">Welcome, {actor.name}</p>
      <p className="text-sm text-slate-600">
        Figures, charts and recent activity appear here once customers, bikes and installment
        plans are added (later phases).
      </p>
    </Card>
  );
}
