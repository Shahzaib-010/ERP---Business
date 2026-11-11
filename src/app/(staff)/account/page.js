import { Suspense } from "react";
import { KeyRoundIcon, UserCogIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { ROLE_LABELS } from "@/lib/permissions-catalog";
import { initials } from "@/lib/format";
import { ChangePasswordForm } from "./change-password-form";

export const metadata = { title: "My account" };

export default function AccountPage() {
  return (
    <Suspense fallback={<PageSkeleton variant="form" />}>
      <AccountContent />
    </Suspense>
  );
}

async function AccountContent() {
  const actor = await requireStaffPage();
  return (
    <PageBody className="mx-auto w-full max-w-3xl">
      <PageHeader icon={UserCogIcon} title="My account" description="Your sign-in details and password." />

      <Card>
        <CardContent className="flex items-center gap-4">
          <Avatar className="size-14">
            <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">{initials(actor.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-lg font-semibold">{actor.name}</p>
            <p className="font-mono text-sm text-muted-foreground">@{actor.username}</p>
          </div>
          <Badge className="ml-auto">{ROLE_LABELS[actor.role]}</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <KeyRoundIcon className="size-4 text-primary" /> Change password
          </CardTitle>
          <CardDescription>Other devices where you are signed in will be signed out.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </PageBody>
  );
}
