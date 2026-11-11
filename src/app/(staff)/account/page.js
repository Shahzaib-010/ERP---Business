import { Suspense } from "react";
import { Card, LoadingBlock, PageHeader } from "@/components/ui";
import { requireStaffPage } from "@/server/auth/current";
import { ROLE_LABELS } from "@/lib/permissions-catalog";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "My account" };

export default function AccountPage() {
  return (
    <>
      <PageHeader title="My account" />
      <Suspense fallback={<LoadingBlock />}>
        <AccountContent />
      </Suspense>
    </>
  );
}

async function AccountContent() {
  const actor = await requireStaffPage();
  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        {actor.name} · {actor.username} · {ROLE_LABELS[actor.role]}
      </p>
      <Card className="max-w-md">
        <h2 className="mb-4 font-medium">Change my password</h2>
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
