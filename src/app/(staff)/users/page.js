import Link from "next/link";
import { Suspense } from "react";
import { CrownIcon, PencilIcon, ShieldCheckIcon, UserPlusIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageBody, PageHeader } from "@/components/app/page-header";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { listStaff } from "@/server/services/users";
import { ROLE_LABELS } from "@/lib/permissions-catalog";
import { formatDateTime, formatRelative, initials } from "@/lib/format";

export const metadata = { title: "Staff accounts" };

export default function UsersPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StaffTable />
    </Suspense>
  );
}

const ROLE_STYLES = {
  superadmin: "bg-primary text-primary-foreground",
  admin: "bg-primary/10 text-primary",
  user: "bg-secondary text-secondary-foreground",
};

async function StaffTable() {
  const actor = await requireStaffPage("users.manage");
  const users = await listStaff(actor);

  return (
    <PageBody>
      <PageHeader
        icon={ShieldCheckIcon}
        title="Staff accounts"
        description="Who can sign in to the staff app and what they can do. Only the Superadmin sees this page."
        actions={
          <Button asChild>
            <Link href="/users/new">
              <UserPlusIcon /> Add staff account
            </Link>
          </Button>
        }
      />

      <Card className="gap-0 overflow-hidden py-0">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="pl-4">Person</TableHead>
              <TableHead>Role</TableHead>
              <TableHead className="hidden sm:table-cell">Status</TableHead>
              <TableHead className="hidden md:table-cell">Last sign-in</TableHead>
              <TableHead className="w-12 pr-4">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => {
              const editable = u.role !== "superadmin";
              return (
                <TableRow key={u.id} className={u.isActive ? "" : "opacity-60"}>
                  <TableCell className="pl-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="size-8">
                        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(u.name)}</AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        {editable ? (
                          <Link href={`/users/${u.id}`} className="font-medium hover:text-primary">
                            {u.name}
                          </Link>
                        ) : (
                          <span className="font-medium">
                            {u.name} {u.id === actor.id && <span className="text-muted-foreground">(you)</span>}
                          </span>
                        )}
                        <p className="font-mono text-xs text-muted-foreground">@{u.username}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={ROLE_STYLES[u.role]}>
                      {u.role === "superadmin" && <CrownIcon />}
                      {ROLE_LABELS[u.role]}
                    </Badge>
                    {u.role === "user" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {u.permissions.length} permission{u.permissions.length === 1 ? "" : "s"}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {u.isActive ? (
                      <Badge variant="outline" className="gap-1.5">
                        <span className="size-1.5 rounded-full bg-success" /> Active
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="gap-1.5 text-muted-foreground">
                        <span className="size-1.5 rounded-full bg-destructive" /> Disabled
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden text-muted-foreground md:table-cell">
                    {u.lastLoginAt ? <time title={formatDateTime(u.lastLoginAt)}>{formatRelative(u.lastLoginAt)}</time> : "Never"}
                  </TableCell>
                  <TableCell className="pr-4 text-right">
                    {editable ? (
                      <Button variant="ghost" size="icon-sm" asChild aria-label={`Edit ${u.name}`}>
                        <Link href={`/users/${u.id}`}>
                          <PencilIcon />
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon-sm" asChild aria-label="My account">
                        <Link href="/account">
                          <PencilIcon />
                        </Link>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </PageBody>
  );
}
