import Link from "next/link";
import { Suspense } from "react";
import { Badge, ButtonLink, Card, LoadingBlock, PageHeader } from "@/components/ui";
import { requireStaffPage } from "@/server/auth/current";
import { listStaff } from "@/server/services/users";
import { ROLE_LABELS } from "@/lib/permissions-catalog";

export const metadata = { title: "Staff accounts" };

const dateFmt = new Intl.DateTimeFormat("en-PK", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Karachi",
});

export default function UsersPage() {
  return (
    <>
      <PageHeader
        title="Staff accounts"
        description="Only the Superadmin can see and change this page."
        action={<ButtonLink href="/users/new">Add staff account</ButtonLink>}
      />
      <Suspense fallback={<LoadingBlock />}>
        <StaffTable />
      </Suspense>
    </>
  );
}

async function StaffTable() {
  const actor = await requireStaffPage("users.manage");
  const users = await listStaff(actor);

  return (
    <>
      <Card className="overflow-x-auto p-0">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2 font-medium">Name</th>
              <th className="px-4 py-2 font-medium">Username</th>
              <th className="px-4 py-2 font-medium">Role</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Last login</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50">
                <td className="px-4 py-2">
                  {u.role === "superadmin" ? (
                    u.name
                  ) : (
                    <Link href={`/users/${u.id}`} className="font-medium underline-offset-2 hover:underline">
                      {u.name}
                    </Link>
                  )}
                </td>
                <td className="px-4 py-2 font-mono text-xs">{u.username}</td>
                <td className="px-4 py-2">
                  <Badge tone={u.role === "user" ? "slate" : "blue"}>{ROLE_LABELS[u.role]}</Badge>
                </td>
                <td className="px-4 py-2">
                  {u.isActive ? <Badge tone="green">Active</Badge> : <Badge tone="red">Disabled</Badge>}
                </td>
                <td className="px-4 py-2 text-slate-600">
                  {u.lastLoginAt ? dateFmt.format(u.lastLoginAt) : "Never"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
