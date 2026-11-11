import Link from "next/link";
import { ArrowLeftIcon, CompassIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon" className="size-12">
            <CompassIcon className="size-6" />
          </EmptyMedia>
          <p className="text-5xl font-bold tracking-tight text-primary">404</p>
          <EmptyTitle className="text-lg">Page not found</EmptyTitle>
          <EmptyDescription>The page you are looking for does not exist.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild>
            <Link href="/">
              <ArrowLeftIcon /> Go home
            </Link>
          </Button>
        </EmptyContent>
      </Empty>
    </main>
  );
}
