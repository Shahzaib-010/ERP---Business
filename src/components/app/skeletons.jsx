import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function HeaderSkeleton() {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <Skeleton className="hidden size-10 rounded-xl sm:block" />
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
      <Skeleton className="h-8 w-28" />
    </div>
  );
}

export function TableSkeleton({ rows = 6 }) {
  return (
    <Card className="gap-0 py-0">
      <div className="border-b p-4">
        <Skeleton className="h-8 w-full max-w-sm" />
      </div>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="hidden h-4 w-32 sm:block" />
          <Skeleton className="hidden h-4 w-24 md:block" />
        </div>
      ))}
    </Card>
  );
}

export function CardsSkeleton({ count = 4 }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="space-y-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <Card>
      <CardContent className="grid gap-6 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function PageSkeleton({ variant = "table" }) {
  return (
    <div className="flex flex-col gap-6">
      <HeaderSkeleton />
      {variant === "cards" && <CardsSkeleton />}
      {variant === "form" ? <FormSkeleton /> : <TableSkeleton />}
    </div>
  );
}

/** Shown while the staff shell checks the session. */
export function ShellSkeleton() {
  return (
    <div className="flex min-h-svh w-full">
      <div className="hidden w-64 shrink-0 flex-col gap-4 p-4 md:flex">
        <div className="flex items-center gap-2">
          <Skeleton className="size-8 rounded-lg" />
          <Skeleton className="h-4 w-32" />
        </div>
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-8 w-full" />
        ))}
      </div>
      <div className="flex-1 p-2">
        <div className="h-full rounded-xl border bg-background p-6">
          <PageSkeleton />
        </div>
      </div>
    </div>
  );
}
