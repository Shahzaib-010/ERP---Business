import { Suspense } from "react";
import { FileTextIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { HeaderSkeleton } from "@/components/app/skeletons";
import { requireCustomerPage } from "@/server/auth/current";

export const metadata = { title: "My account" };

export default function PortalHomePage() {
  return (
    <Suspense fallback={<HeaderSkeleton />}>
      <PortalContent />
    </Suspense>
  );
}

async function PortalContent() {
  const actor = await requireCustomerPage();
  return (
    <div className="flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
      <div>
        <p className="text-sm text-muted-foreground">Assalam-o-Alaikum,</p>
        <h1 className="text-2xl font-semibold tracking-tight">{actor.name}</h1>
      </div>
      {/* Phase 4: this customer's own plans and payment history. */}
      <Card>
        <CardContent>
          <Empty className="py-12">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <FileTextIcon />
              </EmptyMedia>
              <EmptyTitle>Your installment plans</EmptyTitle>
              <EmptyDescription>Your plans, payments and remaining balance will appear here.</EmptyDescription>
            </EmptyHeader>
          </Empty>
        </CardContent>
      </Card>
    </div>
  );
}
