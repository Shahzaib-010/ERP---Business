import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { BUSINESS } from "@/lib/business";
import { PublicFooter, PublicHeader } from "../_landing/public-chrome";
import { Showroom } from "../_landing/showroom";

export const metadata = {
  title: "Showroom",
  description: `Explore ${BUSINESS.name} motorcycles in 3D and try every colour.`,
};

function ShowroomSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_1.35fr]">
      <div className="space-y-6">
        <Skeleton className="h-9 w-72 rounded-full" />
        <Skeleton className="h-16 w-64" />
        <Skeleton className="h-12 w-full max-w-md" />
        <Skeleton className="h-16 w-full max-w-md" />
      </div>
      <Skeleton className="aspect-[16/11] w-full rounded-3xl" />
    </div>
  );
}

export default function ShowroomPage() {
  return (
    <main className="flex min-h-svh flex-1 flex-col">
      <PublicHeader active="showroom" />
      <Suspense fallback={<ShowroomSkeleton />}>
        <Showroom />
      </Suspense>
      <PublicFooter />
    </main>
  );
}
