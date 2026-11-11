import Link from "next/link";
import { ArrowLeftIcon, FileQuestionIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";

export default function StaffNotFound() {
  return (
    <Empty className="min-h-[60vh]">
      <EmptyHeader>
        <EmptyMedia variant="icon" className="size-12">
          <FileQuestionIcon className="size-6" />
        </EmptyMedia>
        <EmptyTitle className="text-lg">Record not found</EmptyTitle>
        <EmptyDescription>It may have been removed, or the link is wrong.</EmptyDescription>
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
