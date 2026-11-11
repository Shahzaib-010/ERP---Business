import Link from "next/link";
import { Suspense } from "react";
import { getStaffActor } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { ROLE_LABELS } from "@/lib/permissions-catalog";
import { BUSINESS } from "@/lib/business";
import { logoutAction } from "@/app/auth-actions";

// The shell renders at once; the parts that need the session stream in.
export default function StaffLayout({ children }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/dashboard" className="font-semibold">
            {BUSINESS.name}
          </Link>
          <Suspense fallback={<div className="h-5 flex-1" />}>
            <StaffNav />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}

async function StaffNav() {
  const actor = await getStaffActor();
  if (!actor) return <div className="flex-1" />;

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    can(actor, "users.manage") && { href: "/users", label: "Staff accounts" },
  ].filter(Boolean);

  return (
    <>
      <nav className="flex flex-1 flex-wrap gap-4 text-sm">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="text-slate-700 hover:text-slate-950">
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="flex items-center gap-3 text-sm">
        <Link href="/account" className="text-slate-700 hover:text-slate-950">
          {actor.name} <span className="text-slate-400">({ROLE_LABELS[actor.role]})</span>
        </Link>
        <form action={logoutAction}>
          <button type="submit" className="text-slate-500 underline hover:text-slate-900">
            Log out
          </button>
        </form>
      </div>
    </>
  );
}
