import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { Alert, Card, LoadingBlock, PageHeader } from "@/components/ui";
import { requireStaffPage } from "@/server/auth/current";
import { getStaff } from "@/server/services/users";
import { NotFoundError } from "@/server/errors";
import { resetStaffPasswordAction, updateStaffAction } from "../actions";
import { StaffForm } from "../staff-form";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Edit staff account" };

export default function EditStaffPage({ params, searchParams }) {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <EditStaffContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function EditStaffContent({ params, searchParams }) {
  const actor = await requireStaffPage("users.manage");
  const { id } = await params;
  const { created } = await searchParams;

  let user;
  try {
    user = await getStaff(actor, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  // Superadmin accounts (including your own) are managed from "My account".
  if (user.role === "superadmin") redirect("/account");

  return (
    <>
      <PageHeader title={user.name} description={`Username: ${user.username}`} />
      <div className="space-y-6">
        {created && <Alert tone="success">Account created.</Alert>}
        <Card>
          <StaffForm action={updateStaffAction.bind(null, user.id)} user={user} />
        </Card>
        <Card className="max-w-md">
          <h2 className="mb-1 font-medium">Reset password</h2>
          <p className="mb-4 text-sm text-slate-600">
            Sets a new password and signs this person out of every device.
          </p>
          <ResetPasswordForm action={resetStaffPasswordAction.bind(null, user.id)} />
        </Card>
      </div>
    </>
  );
}
