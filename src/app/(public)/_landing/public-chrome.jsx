import Link from "next/link";
import { BUSINESS } from "@/lib/business";

export const tel = (phone) => `tel:${phone.replace(/\D/g, "")}`;

function Mark() {
  // Small monogram: an "S" stroke with a yellow speed line.
  return (
    <svg viewBox="0 0 32 32" className="size-7" aria-hidden="true">
      <path d="M22 9c-1.6-1.4-3.6-2-5.8-2C12.6 7 10 8.8 10 11.6c0 5.6 12 3.6 12 9.4 0 2.6-2.6 4-6 4-2.5 0-4.6-.8-6-2.2" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M4 16h5" stroke="var(--brand)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function PublicHeader({ active, tone = "light" }) {
  const dark = tone === "dark";
  const link = (href, label, key) => (
    <Link
      href={href}
      className={`relative py-1 transition-colors ${
        active === key
          ? `${dark ? "text-white" : "text-foreground"} after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:bg-brand`
          : dark
            ? "text-white/60 hover:text-white"
            : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <header
      className={`sticky top-0 z-30 backdrop-blur ${dark ? "bg-black/70 text-white" : "bg-background/80 supports-[backdrop-filter]:bg-background/65"}`}
    >
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-6 px-5 sm:px-8">
        <Link href="/" className="flex items-center gap-2" aria-label={`${BUSINESS.name} home`}>
          <Mark />
          <span className="text-sm font-semibold tracking-tight">{BUSINESS.name}</span>
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          {link("/showroom", "Showroom", "showroom")}
          {link("/#visit", "Visit", "visit")}
          <a href={tel(BUSINESS.contacts[0].phone)} className={`hidden tabular-nums sm:inline ${dark ? "text-white/60 hover:text-white" : "text-muted-foreground hover:text-foreground"}`}>
            {BUSINESS.contacts[0].phone}
          </a>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-5 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>
          {BUSINESS.name} · Auto Market, Rahim Yar Khan
        </span>
        <span className="flex gap-5">
          <Link href="/login/customer" className="hover:text-foreground">
            Customer login
          </Link>
          <Link href="/login" className="hover:text-foreground">
            Staff
          </Link>
        </span>
      </div>
    </footer>
  );
}
