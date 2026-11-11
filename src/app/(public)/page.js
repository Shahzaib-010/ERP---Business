import Link from "next/link";
import { ArrowRightIcon, ArrowUpRightIcon } from "lucide-react";
import { BUSINESS } from "@/lib/business";
import { SHOWROOM_MODELS } from "@/lib/showroom";
import { BikeArt } from "./_landing/bike-art";
import { PublicFooter, PublicHeader, tel } from "./_landing/public-chrome";
import { RideTimeline } from "./_landing/ride-timeline";

export const metadata = {
  title: { absolute: `${BUSINESS.name} — Motorcycle showroom, Rahim Yar Khan` },
  description: "Motorcycle showroom in the Auto Market, Rahim Yar Khan. See every model and colour.",
};

const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(BUSINESS.address)}`;
const allColours = SHOWROOM_MODELS.flatMap((m) => m.colors);
const engineCc = SHOWROOM_MODELS.map((m) => ({ name: m.name, cc: parseInt(m.specs[0].value, 10) }));

const STATS = [
  { value: String(SHOWROOM_MODELS.length), unit: "", label: "Models" },
  { value: String(allColours.length), unit: "", label: "Colours" },
  { value: String(Math.max(...engineCc.map((e) => e.cc))), unit: "cc", label: "Largest engine" },
  { value: "360", unit: "°", label: "3D view" },
];

function Stat({ value, unit, label, dark }) {
  return (
    <div className="text-center">
      <p className={`font-condensed text-4xl font-semibold tabular-nums sm:text-5xl ${dark ? "text-white" : ""}`}>
        {value}
        <sup className="ml-0.5 align-super text-sm font-normal text-muted-foreground">{unit}</sup>
      </p>
      <p className={`mt-1 text-[0.7rem] tracking-[0.18em] uppercase ${dark ? "text-white/45" : "text-muted-foreground"}`}>{label}</p>
    </div>
  );
}

/** Dark close-up section: drawing on one side, title and figures on the other. */
function Feature({ id, title, lead, text, art, figures, flip, children }) {
  return (
    <section id={id} className={`relative overflow-hidden bg-[oklch(0.13_0_0)] text-white ${flip ? "border-t border-white/5" : ""}`}>
      <div className={`mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-20 sm:px-8 lg:grid-cols-[1.25fr_1fr] lg:py-20 ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}>
        <div className="relative [mask-image:radial-gradient(ellipse_62%_62%_at_50%_50%,black_45%,transparent_100%)]">{art}</div>
        <div>
          <h2 className="text-5xl font-bold tracking-tight sm:text-6xl">{title}</h2>
          <p className="mt-6 max-w-md text-sm leading-relaxed text-white/60">
            <strong className="font-semibold text-white">{lead}</strong> {text}
          </p>
          {figures && (
            <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-4">
              {figures.map((f) => (
                <div key={f.label} className="flex flex-col-reverse">
                  <dt className="text-[0.7rem] tracking-[0.15em] text-white/45 uppercase">{f.label}</dt>
                  <dd className="font-condensed text-3xl font-semibold tabular-nums">
                    {f.value}
                    <span className="ml-0.5 text-sm font-normal text-white/50">{f.unit}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {children}
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <main className="flex min-h-svh flex-1 flex-col">
      <PublicHeader />

      {/* Hero: the bike, centred, with key figures underneath */}
      <section className="bg-[oklch(0.965_0.002_90)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-5 pt-16 pb-20 text-center sm:px-8 sm:pt-20">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">What makes {BUSINESS.name} special</h1>
          <p className="mt-2 text-sm text-muted-foreground">New and used motorcycles in the Auto Market, Rahim Yar Khan.</p>

          <BikeArt className="mt-10 w-full max-w-2xl animate-in fade-in-0 zoom-in-95 duration-700" />

          <div className="mt-10 grid w-full max-w-2xl grid-cols-2 gap-y-8 sm:grid-cols-4">
            {STATS.map((s) => (
              <Stat key={s.label} {...s} />
            ))}
          </div>

          <Link href="/showroom" className="group mt-12 inline-flex items-center gap-2 border-b border-foreground pb-1 text-sm font-medium">
            Explore the showroom in 3D
            <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
      </section>

      <Feature
        id="engine"
        title="Engine"
        lead={`From ${Math.min(...engineCc.map((e) => e.cc))} cc to ${Math.max(...engineCc.map((e) => e.cc))} cc.`}
        text="Light commuters for the daily run, and stronger engines for longer trips and the highway. Every engine on the line-up is on display at the showroom."
        figures={engineCc.map((e) => ({ value: e.cc, unit: "cc", label: e.name }))}
        art={
          <div className="relative">
            <BikeArt tone="dark" highlight="engine" viewBox="250 150 400 260" className="w-full" title="Engine close-up" />
            <span className="absolute top-[12%] left-[6%] font-condensed text-xs tracking-[0.2em] text-brand uppercase">
              {engineCc.map((e) => e.cc).join(" / ")} cc
            </span>
          </div>
        }
      />

      <Feature
        id="colour"
        title="Colour"
        flip
        lead={`${allColours.length} colours across the line-up.`}
        text="From classic red to matte black. Try every one in the 3D showroom, then come and see the real paint in person."
        art={
          <div className="relative">
            <BikeArt tone="dark" highlight="tank" viewBox="330 70 300 200" className="w-full" title="Fuel tank close-up" />
            <span className="absolute right-[6%] bottom-[10%] font-condensed text-xs tracking-[0.2em] text-brand uppercase">
              {SHOWROOM_MODELS[0].colors.length} per model
            </span>
          </div>
        }
      >
        <div className="mt-8 flex flex-wrap gap-2">
          {allColours.map((c) => (
            <span key={`${c.name}-${c.hex}`} title={c.name} className="size-6 rounded-full ring-1 ring-white/15" style={{ background: c.hex }} />
          ))}
        </div>
        <Link href="/showroom" className="group mt-8 inline-flex items-center gap-2 border-b border-brand pb-1 text-sm font-medium text-white">
          Try the colours
          <ArrowRightIcon className="size-4 text-brand transition-transform group-hover:translate-x-1" />
        </Link>
      </Feature>

      {/* Timeline */}
      <section className="border-t border-white/10 bg-[oklch(0.13_0_0)] text-white">
        <div className="mx-auto w-full max-w-6xl px-5 pt-20 pb-24 sm:px-8">
          <h2 className="text-center font-condensed text-3xl font-light tracking-[0.12em] uppercase sm:text-5xl">Your ride, step by step</h2>
          <div className="mt-12">
            <RideTimeline />
          </div>
        </div>
      </section>

      {/* Visit */}
      <section id="visit" className="scroll-mt-14 bg-[oklch(0.965_0.002_90)]">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-end">
          <div>
            <p lang="ur" dir="rtl" className="text-right text-3xl lg:text-left">
              {BUSINESS.nameUrdu}
            </p>
            <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Visit the showroom</h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              Every model and colour is waiting for you. Drop in, or call before you come.
            </p>
          </div>
          <div className="divide-y border-y text-sm">
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between gap-4 py-5">
              <span>
                <span className="block text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">Address</span>
                <span className="mt-1 block font-medium">{BUSINESS.address}</span>
              </span>
              <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
            </a>
            {BUSINESS.contacts.map((c) => (
              <a key={c.phone} href={tel(c.phone)} className="group flex items-center justify-between gap-4 py-5">
                <span>
                  <span className="block text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">{c.name}</span>
                  <span className="mt-1 block font-condensed text-2xl font-semibold tabular-nums">{c.phone}</span>
                </span>
                <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
              </a>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
