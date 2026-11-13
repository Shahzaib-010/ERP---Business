import { cacheLife } from "next/cache";
import Link from "next/link";
import { BUSINESS } from "@/lib/business";
import { LoginMenu } from "./login-menu";

export const tel = (phone) => `tel:+92${phone.replace(/\D/g, "").replace(/^0/, "")}`;
export const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(BUSINESS.mapLocation)}`;

export function Mark({ className = "size-7" }) {
  // Small monogram: an "S" stroke with a speed line in the brand colour.
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <path d="M22 9c-1.6-1.4-3.6-2-5.8-2C12.6 7 10 8.8 10 11.6c0 5.6 12 3.6 12 9.4 0 2.6-2.6 4-6 4-2.5 0-4.6-.8-6-2.2" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M4 16h5" stroke="var(--brand)" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

export function PublicHeader({ active, tone = "light" }) {
  const dark = tone === "dark";
  const link = (href, label, key, extra = "") => (
    <Link
      href={href}
      className={`relative py-1 transition-colors ${extra} ${
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
        <nav className="flex items-center gap-4 text-sm sm:gap-6">
          {link("/showroom", "Showroom", "showroom")}
          {link("/about", "About", "about", "hidden sm:inline")}
          {link("/contact", "Contact", "contact", "hidden sm:inline")}
          <a
            href={tel(BUSINESS.owner.phone)}
            className={`hidden tabular-nums lg:inline ${dark ? "text-white/60 hover:text-white" : "text-muted-foreground hover:text-foreground"}`}
          >
            {BUSINESS.owner.phone}
          </a>
          <LoginMenu dark={dark} />
        </nav>
      </div>
    </header>
  );
}

const FOOTER_LINKS = [
  {
    title: "Showroom",
    links: [
      { href: "/showroom", label: "3D showroom" },
      { href: "/#lineup", label: "Line-up" },
      { href: "/#faq", label: "Questions" },
    ],
  },
  {
    title: "Business",
    links: [
      { href: "/about", label: "About us" },
      { href: "/contact", label: "Contact" },
      { href: "/login/customer", label: "Customer login" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of use" },
    ],
  },
];

async function CopyrightYear() {
  "use cache";
  cacheLife("days");
  return new Date().getFullYear();
}

export function PublicFooter() {
  return (
    <footer className="border-t bg-background">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="space-y-4">
          <Link href="/" className="flex items-center gap-2">
            <Mark />
            <span className="text-sm font-semibold tracking-tight">{BUSINESS.name}</span>
          </Link>
          <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{BUSINESS.address}</p>
          <div>
            <p className="text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">Owner · {BUSINESS.owner.name}</p>
            <a href={tel(BUSINESS.owner.phone)} className="mt-1 inline-block font-condensed text-2xl font-semibold tabular-nums hover:text-foreground/80">
              {BUSINESS.owner.phone}
            </a>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-3">
          {FOOTER_LINKS.map((group) => (
            <div key={group.title}>
              <p className="text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">{group.title}</p>
              <ul className="mt-4 space-y-2.5 text-sm">
                {group.links.map((l) => (
                  <li key={l.href}>
                    <Link href={l.href} className="text-foreground/80 transition-colors hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>
            © <CopyrightYear /> {BUSINESS.name}. All rights reserved.
          </span>
          <span className="flex gap-5">
            <Link href="/privacy" className="hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              Terms
            </Link>
            <Link href="/login" className="hover:text-foreground">
              Staff
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}

/** Simple text page (about, privacy, terms): light title band, then a narrow reading column. */
export function PageShell({ active, eyebrow, title, lead, children }) {
  return (
    <main className="flex min-h-svh flex-1 flex-col">
      <PublicHeader active={active} />
      <section className="border-b bg-[oklch(0.97_0.004_264)]">
        <div className="mx-auto w-full max-w-6xl px-5 pt-16 pb-12 sm:px-8 sm:pt-20">
          {eyebrow && <p className="font-condensed text-sm font-semibold tracking-[0.2em] text-muted-foreground uppercase">{eyebrow}</p>}
          <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">{title}</h1>
          {lead && <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">{lead}</p>}
        </div>
      </section>
      <div className="flex-1">{children}</div>
      <PublicFooter />
    </main>
  );
}

/** Long-form legal text with consistent heading and paragraph styles. */
export function Prose({ children }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8">
      <div className="max-w-2xl space-y-4 text-sm leading-relaxed text-foreground/80 [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-4 [&_h2]:pt-6 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:tracking-tight [&_h2]:text-foreground [&_li]:pl-1 [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </div>
  );
}
