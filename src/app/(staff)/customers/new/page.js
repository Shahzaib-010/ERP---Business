import { Suspense } from "react";
import { Card, LoadingBlock, PageHeader } from "@/components/ui";
import { requireStaffPage } from "@/server/auth/current";
import { createCustomerAction } from "../actions";
import { CustomerForm } from "../customer-form";

export const metadata = { title: "Add customer" };

export default function NewCustomerPage() {
  return (
    <>
      <PageHeader title="Add customer" description="Fields marked * are required." />
      <Suspense fallback={<LoadingBlock />}>
        <NewCustomerContent />
      </Suspense>
    </>
  );
}

async function NewCustomerContent() {
  await requireStaffPage("customers.create");
  return (
    <Card>
      <CustomerForm action={createCustomerAction} cancelHref="/customers" />
    </Card>
  );
}
