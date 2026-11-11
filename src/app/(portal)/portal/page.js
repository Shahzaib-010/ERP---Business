import { Suspense } from "react";
import { Card, LoadingBlock, PageHeader } from "@/components/ui";
import { requireCustomerPage } from "@/server/auth/current";

export const metadata = { title: "My account" };

export default function PortalHomePage() {
  return (
    <>
      <PageHeader title="My installment plans" />
      <Suspense fallback={<LoadingBlock />}>
        <PortalContent />
      </Suspense>
    </>
  );
}

async function PortalContent() {
  const actor = await requireCustomerPage();
  return (
    <Card>
      <p className="mb-2 font-medium">Assalam-o-Alaikum, {actor.name}</p>
      {/* Phase 4: this customer's own plans and payment history. */}
      <p className="text-sm text-slate-600">Your installment plans will be shown here.</p>
    </Card>
  );
}
