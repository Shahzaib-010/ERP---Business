import { Suspense } from "react";
import { notFound, redirect } from "next/navigation";
import { KeyRoundIcon, UserCogIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BreadcrumbLabel } from "@/components/app/breadcrumbs";
import { FlashToast } from "@/components/app/flash-toast";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { getStaff } from "@/server/services/users";
import { NotFoundError } from "@/server/errors";
import { ROLE_LABELS } from "@/lib/permissions-catalog";
import { resetStaffPasswordAction, updateStaffAction } from "../actions";
import { StaffForm } from "../staff-form";
import { ResetPasswordForm } from "./reset-password-form";

export const metadata = { title: "Edit staff account" };

export default function EditStaffPage({ params }) {
  return (
    <Suspense fallback={<PageSkeleton variant="form" />}>
      <EditStaffContent params={params} />
    </Suspense>
  );
}

async function EditStaffContent({ params }) {
  const actor = await requireStaffPage("users.manage");
  const { id } = await params;

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
    <PageBody className="mx-auto w-full max-w-4xl">
      <BreadcrumbLabel segment={user.id} label={user.name} />
      <FlashToast messages={{ "1": { title: "Account created", description: "Give the person their username and starting password." } }} param="created" />
      <PageHeader icon={UserCogIcon} title={user.name} description={`@${user.username} · ${ROLE_LABELS[user.role]}`} />
      <StaffForm action={updateStaffAction.bind(null, user.id)} user={user} />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRoundIcon className="size-4 text-primary" /> Reset password
          </CardTitle>
          <CardDescription>Sets a new password and signs this person out of every device.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm action={resetStaffPasswordAction.bind(null, user.id)} />
        </CardContent>
      </Card>
    </PageBody>
  );
}
