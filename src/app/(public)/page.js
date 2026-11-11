import { ButtonLink } from "@/components/ui";
import { BUSINESS } from "@/lib/business";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center">
        <p lang="ur" dir="rtl" className="text-3xl font-bold text-slate-800">
          {BUSINESS.nameUrdu}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{BUSINESS.name}</h1>
        <p className="max-w-xl text-slate-600">
          Motorcycles and installment sales. {BUSINESS.address}.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink href="/login">Staff login</ButtonLink>
          <ButtonLink href="/login/customer" variant="secondary">
            Customer login
          </ButtonLink>
        </div>
      </section>
      <footer className="border-t border-slate-200 px-4 py-4 text-center text-sm text-slate-500">
        {BUSINESS.contacts.map((c) => `${c.name}: ${c.phone}`).join(" · ")}
      </footer>
    </main>
  );
}
