"use client";

import Link from "next/link";
import { useEffect } from "react";
import { HomeIcon, RotateCcwIcon, TriangleAlertIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function StaffError({ error, reset }) {
  useEffect(() => {
    // Only the digest: the message may contain request data.
    console.error("[staff page error]", error?.digest ?? "");
  }, [error]);

  return (
    <Empty className="min-h-[60vh]">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-12 bg-destructive/10 text-destructive">
          <TriangleAlertIcon className="size-6" />
        </EmptyMedia>
        <EmptyTitle className="text-lg">Something went wrong</EmptyTitle>
        <EmptyDescription>
          This page could not be loaded. Try again; if it keeps happening, tell the Superadmin
          {error?.digest ? ` and quote code ${error.digest}` : ""}.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent className="flex-row justify-center">
        <Button onClick={() => reset()}>
          <RotateCcwIcon /> Try again
        </Button>
        <Button variant="outline" asChild>
          <Link href="/dashboard">
            <HomeIcon /> Dashboard
          </Link>
        </Button>
      </EmptyContent>
    </Empty>
  );
}
