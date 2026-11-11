import { Suspense } from "react";
import { UserPlusIcon } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { createCustomerAction } from "../actions";
import { CustomerForm } from "../customer-form";

export const metadata = { title: "Add customer" };

export default function NewCustomerPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="form" />}>
      <NewCustomerContent />
    </Suspense>
  );
}

async function NewCustomerContent() {
  await requireStaffPage("customers.create");
  return (
    <PageBody className="mx-auto w-full max-w-4xl">
      <PageHeader
        icon={UserPlusIcon}
        title="Add customer"
        description="Fields marked * are required. Everything else can be filled in later."
      />
      <CustomerForm action={createCustomerAction} cancelHref="/customers" />
    </PageBody>
  );
}
