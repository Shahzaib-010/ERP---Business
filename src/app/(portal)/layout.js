import { Suspense } from "react";
import { BUSINESS } from "@/lib/business";
import { getCustomerActor } from "@/server/auth/current";
import { logoutAction } from "@/app/auth-actions";

// Customer portal: separate, simple and read-only.
export default function PortalLayout({ children }) {
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-3">
          <span className="font-semibold">{BUSINESS.name}</span>
          <Suspense fallback={null}>
            <PortalUser />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
      <footer className="px-4 py-4 text-center text-xs text-slate-500">
        Questions about your account? Call {BUSINESS.contacts[0].phone}
      </footer>
    </div>
  );
}

async function PortalUser() {
  const actor = await getCustomerActor();
  if (!actor) return null;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-slate-700">{actor.name}</span>
      <form action={logoutAction}>
        <button type="submit" className="text-slate-500 underline hover:text-slate-900">
          Log out
        </button>
      </form>
    </div>
  );
}
