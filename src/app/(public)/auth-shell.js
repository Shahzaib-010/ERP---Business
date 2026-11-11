import Link from "next/link";
import { BikeIcon, MapPinIcon, PhoneIcon, ShieldCheckIcon } from "lucide-react";
import { BUSINESS } from "@/lib/business";

/** Split screen used by the login pages: brand panel on the left (desktop), form on the right. */
export function AuthShell({ title, description, children, footer }) {
  return (
    <main className="grid min-h-svh flex-1 lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-primary p-10 text-primary-foreground lg:flex lg:flex-col">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,oklch(1_0_0/0.18),transparent_45%),radial-gradient(circle_at_80%_80%,oklch(0_0_0/0.25),transparent_50%)]" />
        <div className="pointer-events-none absolute -right-24 -bottom-24 size-96 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-8 -bottom-8 size-64 rounded-full border border-white/10" />

        <Link href="/" className="relative flex items-center gap-2 font-semibold">
          <span className="flex size-9 items-center justify-center rounded-lg bg-white/15 backdrop-blur">
            <BikeIcon className="size-5" />
          </span>
          {BUSINESS.name}
        </Link>

        <div className="relative mt-auto space-y-6">
          <p lang="ur" dir="rtl" className="text-right text-4xl font-bold">
            {BUSINESS.nameUrdu}
          </p>
          <blockquote className="max-w-md text-lg leading-relaxed text-primary-foreground/90">
            Motorcycles and installment sales — customers, plans, payments and receipts in one place.
          </blockquote>
          <ul className="space-y-2 text-sm text-primary-foreground/80">
            <li className="flex items-center gap-2">
              <MapPinIcon className="size-4" /> {BUSINESS.address}
            </li>
            {BUSINESS.contacts.map((c) => (
              <li key={c.phone} className="flex items-center gap-2">
                <PhoneIcon className="size-4" /> {c.name}: {c.phone}
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <section className="flex flex-col p-6 sm:p-10">
        <Link href="/" className="flex items-center gap-2 font-semibold lg:hidden">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BikeIcon className="size-4" />
          </span>
          {BUSINESS.name}
        </Link>
        <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 py-10 animate-in fade-in-0 slide-in-from-bottom-2 duration-500">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            {description && <p className="text-sm text-muted-foreground">{description}</p>}
          </div>
          {children}
          {footer && <div className="space-y-2 text-center text-sm text-muted-foreground">{footer}</div>}
        </div>
        <p className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <ShieldCheckIcon className="size-3.5" /> Private system. Access is logged.
        </p>
      </section>
    </main>
  );
}
