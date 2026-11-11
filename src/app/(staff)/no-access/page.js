import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeftIcon, LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";

export const metadata = { title: "No access" };

export default function NoAccessPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NoAccessContent />
    </Suspense>
  );
}

async function NoAccessContent() {
  await requireStaffPage();
  return (
    <Empty className="min-h-[60vh] animate-in fade-in-0 zoom-in-95 duration-300">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-12 bg-destructive/10 text-destructive">
          <LockIcon className="size-6" />
        </EmptyMedia>
        <EmptyTitle className="text-lg">You don&apos;t have access to that page</EmptyTitle>
        <EmptyDescription>Your account is missing the permission it needs. Ask the Superadmin if you should have it.</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button asChild>
          <Link href="/dashboard">
            <ArrowLeftIcon /> Back to dashboard
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
