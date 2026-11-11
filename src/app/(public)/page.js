import Link from "next/link";
import { ArrowRightIcon, BikeIcon, MapPinIcon, PhoneIcon, ShieldCheckIcon, SmartphoneIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BUSINESS } from "@/lib/business";

const FEATURES = [
  { icon: BikeIcon, title: "New & used motorcycles", text: "Buy a motorcycle on cash or on installments." },
  { icon: WalletIcon, title: "Easy monthly installments", text: "An advance and a fixed monthly amount, agreed with you." },
  { icon: SmartphoneIcon, title: "Check your account online", text: "Customers can see their plans and payments any time." },
];

export default function Home() {
  return (
    <main className="flex min-h-svh flex-1 flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
        <span className="flex items-center gap-2 font-semibold">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BikeIcon className="size-4" />
          </span>
          {BUSINESS.name}
        </span>
        <Button variant="ghost" asChild>
          <Link href="/login">Staff sign in</Link>
        </Button>
      </header>

      <section className="relative flex flex-1 items-center overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_50%_-10%,color-mix(in_oklch,var(--primary)_14%,transparent),transparent)]" />
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center">
          <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-3 duration-700">
            <p lang="ur" dir="rtl" className="text-right text-3xl font-bold text-primary lg:text-left">
              {BUSINESS.nameUrdu}
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
              Motorcycles on cash and easy installments
            </h1>
            <p className="max-w-lg text-lg text-muted-foreground">
              Visit us in the Auto Market, Rahim Yar Khan. Customers with an installment account can check their balance and
              payments online.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button size="lg" className="h-11 px-5" asChild>
                <Link href="/login/customer">
                  Check my account <ArrowRightIcon />
                </Link>
              </Button>
              <Button size="lg" variant="outline" className="h-11 px-5" asChild>
                <a href={`tel:${BUSINESS.contacts[0].phone.replace(/\D/g, "")}`}>
                  <PhoneIcon /> Call {BUSINESS.contacts[0].phone}
                </a>
              </Button>
            </div>
          </div>

          <div className="grid gap-4 animate-in fade-in-0 slide-in-from-bottom-3 duration-700 [animation-delay:150ms] [animation-fill-mode:both]">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex gap-4 rounded-xl border bg-card p-5 shadow-xs">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="size-5" />
                </div>
                <div>
                  <p className="font-medium">{f.title}</p>
                  <p className="text-sm text-muted-foreground">{f.text}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <span className="flex items-center gap-2">
            <MapPinIcon className="size-4" /> {BUSINESS.address}
          </span>
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            {BUSINESS.contacts.map((c) => (
              <a key={c.phone} href={`tel:${c.phone.replace(/\D/g, "")}`} className="hover:text-foreground">
                {c.name}: {c.phone}
              </a>
            ))}
          </span>
          <span className="flex items-center gap-1.5 text-xs">
            <ShieldCheckIcon className="size-3.5" /> Private system
          </span>
        </div>
      </footer>
    </main>
  );
}
