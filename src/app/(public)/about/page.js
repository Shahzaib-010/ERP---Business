import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { BUSINESS } from "@/lib/business";
import { SHOWROOM_MODELS } from "@/lib/showroom";
import { BikeArt } from "../_landing/bike-art";
import { PageShell, tel } from "../_landing/public-chrome";

export const metadata = {
  title: "About us",
  description: `${BUSINESS.name} is a motorcycle showroom in the Auto Market, Rahim Yar Khan.`,
};

const POINTS = [
  { title: "New and used", text: "New motorcycles in every colour of the line-up, and used bikes for a smaller budget." },
  { title: "We buy bikes", text: "Selling your motorcycle? Bring it with its papers and we will talk it over with you." },
  { title: "Deal with the owner", text: `You talk to ${BUSINESS.owner.name} directly, in person or on the phone.` },
];

export default function AboutPage() {
  return (
    <PageShell
      active="about"
      eyebrow="About us"
      title={`${BUSINESS.name}`}
      lead={`A motorcycle showroom in the Auto Market, Rahim Yar Khan, run by ${BUSINESS.owner.name}.`}
    >
      <section className="mx-auto grid w-full max-w-6xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-5 text-sm leading-relaxed text-foreground/80">
          <p lang="ur" dir="rtl" className="text-3xl leading-loose text-foreground lg:text-left">
            {BUSINESS.nameUrdu}
          </p>
          <p>
            {BUSINESS.name} sells new and used motorcycles from its showroom opposite the Ghalla Mandi gate. The line-up runs
            from light {SHOWROOM_MODELS[0].specs[0].value} commuters to {SHOWROOM_MODELS.at(-1).specs[0].value} bikes for the
            highway, and every model is shown in its full range of colours.
          </p>
          <p>
            You can explore the bikes online in our 3D showroom, then visit to see the real paint, sit on the bike and talk
            it through with the owner.
          </p>
          <Link href="/showroom" className="group inline-flex items-center gap-2 border-b border-foreground pb-1 font-medium text-foreground">
            Explore the showroom in 3D
            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        <BikeArt highlight="wheel" className="w-full text-foreground" title="Motorcycle illustration" />
      </section>

      <section className="border-t bg-[oklch(0.97_0.004_264)]">
        <div className="mx-auto grid w-full max-w-6xl px-5 sm:px-8 md:grid-cols-3">
          {POINTS.map((p, i) => (
            <div key={p.title} className={`border-b py-10 md:border-b-0 md:px-6 ${i > 0 ? "md:border-l" : "md:pl-0"}`}>
              <p className="font-condensed text-sm font-semibold tracking-[0.2em] text-muted-foreground">0{i + 1}</p>
              <h2 className="mt-3 text-lg font-semibold">{p.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-16 sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div>
          <p className="text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">Owner · {BUSINESS.owner.name}</p>
          <a href={tel(BUSINESS.owner.phone)} className="mt-1 block font-condensed text-4xl font-semibold tabular-nums">
            {BUSINESS.owner.phone}
          </a>
        </div>
        <Link href="/contact" className="group inline-flex items-center gap-2 border-b border-foreground pb-1 text-sm font-medium">
          Contact and directions
          <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
        </Link>
      </section>
    </PageShell>
  );
}
