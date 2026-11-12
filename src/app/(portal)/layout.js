import Link from "next/link";
import { Suspense } from "react";
import { BikeIcon, LogOutIcon, PhoneIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BUSINESS } from "@/lib/business";
import { initials } from "@/lib/format";
import { getCustomerActor } from "@/server/auth/current";
import { logoutAction } from "@/app/auth-actions";

// Customer portal: separate, simple and read-only.
export default function PortalLayout({ children }) {
  return (
    <div className="flex min-h-svh flex-1 flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4">
          <Link href="/portal" className="flex items-center gap-2 font-semibold">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BikeIcon className="size-4" />
            </span>
            <span className="hidden sm:inline">{BUSINESS.name}</span>
          </Link>
          <Suspense fallback={<Skeleton className="h-8 w-32" />}>
            <PortalUser />
          </Suspense>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t px-4 pt-5 pb-20 text-center text-sm text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <PhoneIcon className="size-3.5" /> Questions about your account? Call{" "}
          <a href={`tel:${BUSINESS.contacts[0].phone.replace(/\D/g, "")}`} className="font-medium text-foreground hover:underline">
            {BUSINESS.contacts[0].phone}
          </a>
        </span>
      </footer>
    </div>
  );
}

async function PortalUser() {
  const actor = await getCustomerActor();
  if (!actor) return null;
  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-8">
        <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">{initials(actor.name)}</AvatarFallback>
      </Avatar>
      <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">{actor.name}</span>
      <form action={logoutAction}>
        <Button type="submit" variant="ghost" size="sm">
          <LogOutIcon /> <span className="hidden sm:inline">Log out</span>
        </Button>
      </form>
    </div>
  );
}
