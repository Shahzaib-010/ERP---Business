import { Suspense } from "react";
import { FileSpreadsheetIcon } from "lucide-react";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { ImportWizard } from "./import-wizard";

export const metadata = { title: "Import customers" };

export default function ImportCustomersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await requireStaffPage("customers.create");
  return (
    <PageBody>
      <PageHeader
        icon={FileSpreadsheetIcon}
        title="Import customers"
        description="Add many customers at once from an Excel or CSV file, or a table copied from Excel or Word."
      />
      <ImportWizard />
    </PageBody>
  );
}
