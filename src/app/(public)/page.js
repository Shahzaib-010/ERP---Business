import Link from "next/link";
import { ArrowRightIcon, ArrowUpRightIcon, PhoneIcon, PlusIcon } from "lucide-react";
import { BUSINESS } from "@/lib/business";
import { SHOWROOM_MODELS } from "@/lib/showroom";
import { BikeArt } from "./_landing/bike-art";
import { PublicFooter, PublicHeader, mapsUrl, tel } from "./_landing/public-chrome";
import { RideTimeline } from "./_landing/ride-timeline";

export const metadata = {
  title: { absolute: `${BUSINESS.name} — Motorcycle showroom, Rahim Yar Khan` },
  description: "New and used motorcycles in the Auto Market, Rahim Yar Khan. See every model and colour.",
};

const allColours = SHOWROOM_MODELS.flatMap((m) => m.colors);
const engineCc = SHOWROOM_MODELS.map((m) => ({ name: m.name, cc: parseInt(m.specs[0].value, 10) }));
const specLabels = SHOWROOM_MODELS[0].specs.map((s) => s.label);

const STATS = [
  { value: String(SHOWROOM_MODELS.length), unit: "", label: "Models" },
  { value: String(allColours.length), unit: "", label: "Colours" },
  { value: String(Math.max(...engineCc.map((e) => e.cc))), unit: "cc", label: "Largest engine" },
  { value: "360", unit: "°", label: "3D view" },
];

const OFFER = [
  {
    n: "01",
    title: "New motorcycles",
    text: "Every model in the line-up, in all of its colours. See the real paint and sit on the bike before you choose.",
  },
  {
    n: "02",
    title: "Used motorcycles",
    text: "Pre-owned bikes for a smaller budget. What is in changes often, so call to ask what is available today.",
  },
  {
    n: "03",
    title: "Sell your motorcycle",
    text: "We buy motorcycles too. Bring your bike and its registration papers to the showroom, or call first to talk it over.",
  },
];

const FAQ = [
  {
    q: "Are the bikes on this website in the showroom?",
    a: "The website shows the line-up. Stock and colours change, so call before you come to check what is in the showroom today.",
  },
  {
    q: "Do you sell used motorcycles?",
    a: "Yes, we sell both new and used motorcycles. Used stock changes often; call the owner to hear what is available.",
  },
  {
    q: "Can I sell my motorcycle to you?",
    a: "Yes. Bring the bike with its registration papers to the showroom, or call first and describe it.",
  },
  {
    q: "How do I find out the price?",
    a: "Prices follow the market, so we give them in person or on the phone. Call or visit and ask about the model you like.",
  },
  {
    q: "I already bought from you. How do I see my account?",
    a: (
      <>
        Use the{" "}
        <Link href="/login/customer" className="font-medium text-foreground underline underline-offset-4">
          customer login
        </Link>{" "}
        with your CNIC and the password the showroom gave you.
      </>
    ),
  },
];

function Stat({ value, unit, label }) {
  return (
    <div className="text-center">
      <p className="font-condensed text-4xl font-semibold tabular-nums sm:text-5xl">
        {value}
        <sup className="ml-0.5 align-super text-sm font-normal text-muted-foreground">{unit}</sup>
      </p>
      <p className="mt-1 text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">{label}</p>
    </div>
  );
}

function Eyebrow({ children, dark }) {
  return (
    <p className={`font-condensed text-sm font-semibold tracking-[0.2em] uppercase ${dark ? "text-brand" : "text-muted-foreground"}`}>{children}</p>
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

/** Line-up: one column per model, specs lined up so they compare at a glance. */
function Lineup() {
  return (
    <section id="lineup" className="scroll-mt-14 bg-background">
      <div className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow>The line-up</Eyebrow>
            <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Compare the models</h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            From a light city commuter to a sporty highway bike. Pick one to see it in 3D.
          </p>
        </div>

        <div className="mt-12 grid border-t md:grid-cols-3">
          {SHOWROOM_MODELS.map((m, i) => (
            <article
              key={m.id}
              className={`group flex flex-col border-b py-8 md:px-6 md:py-10 ${i > 0 ? "md:border-l" : "md:pl-0"} ${i === SHOWROOM_MODELS.length - 1 ? "md:pr-0" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-condensed text-3xl font-semibold tracking-wide uppercase">{m.name}</h3>
                <span className="text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">{m.style}</span>
              </div>
              <p className="mt-3 min-h-[2.75rem] text-sm leading-relaxed text-muted-foreground">{m.tagline}</p>

              <dl className="mt-6 divide-y border-y text-sm">
                {specLabels.map((label) => (
                  <div key={label} className="flex items-center justify-between py-2.5">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="font-medium tabular-nums">{m.specs.find((s) => s.label === label)?.value ?? "—"}</dd>
                  </div>
                ))}
              </dl>

              <div className="mt-6 flex items-center gap-1.5">
                {m.colors.map((c) => (
                  <span key={c.hex} title={c.name} className="size-4 rounded-full ring-1 ring-foreground/15" style={{ background: c.hex }} />
                ))}
                <span className="ml-2 text-xs text-muted-foreground">{m.colors.length} colours</span>
              </div>

              <Link
                href={`/showroom?model=${m.id}`}
                className="mt-8 inline-flex w-fit items-center gap-2 border-b border-foreground pb-1 text-sm font-medium"
              >
                View in 3D
                <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </article>
          ))}
        </div>
        <p className="mt-6 text-xs text-muted-foreground">Specifications are a guide. Ask at the showroom for the exact figures of each bike.</p>
      </div>
    </section>
  );
}

/** What the showroom offers: new, used, and buying bikes from the public. */
function Offer() {
  return (
    <section className="bg-[oklch(0.97_0.004_264)]">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <Eyebrow>At the showroom</Eyebrow>
          <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">New, used, or selling yours</h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Whatever brings you to the Auto Market, you deal with us directly, face to face.
          </p>
        </div>
        <ol className="divide-y border-y">
          {OFFER.map((o) => (
            <li key={o.n} className="grid grid-cols-[3rem_1fr] gap-4 py-7">
              <span className="font-condensed text-sm font-semibold tracking-[0.2em] text-muted-foreground">{o.n}</span>
              <div>
                <h3 className="text-lg font-semibold">{o.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{o.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className="scroll-mt-14 bg-background">
      <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_1.3fr]">
        <div>
          <Eyebrow>Questions</Eyebrow>
          <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">Before you visit</h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Anything else? Call {BUSINESS.owner.name} on{" "}
            <a href={tel(BUSINESS.owner.phone)} className="font-medium whitespace-nowrap text-foreground tabular-nums">
              {BUSINESS.owner.phone}
            </a>
            .
          </p>
        </div>
        <div className="divide-y border-y">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-1 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 text-base font-medium">
                {f.q}
                <PlusIcon className="size-4 shrink-0 text-muted-foreground transition-transform duration-200 group-open:rotate-45" />
              </summary>
              <p className="pb-5 pr-10 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function RowLink({ href, label, value, big, external }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="group flex items-center justify-between gap-4 py-5"
    >
      <span>
        <span className="block text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">{label}</span>
        <span className={`mt-1 block ${big ? "font-condensed text-3xl font-semibold tabular-nums" : "font-medium"}`}>{value}</span>
      </span>
      <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
    </a>
  );
}

export default function Home() {
  return (
    <main className="flex min-h-svh flex-1 flex-col">
      <PublicHeader />

      {/* Hero: the bike, centred, with key figures underneath */}
      <section className="bg-[oklch(0.97_0.004_264)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-5 pt-16 pb-20 text-center sm:px-8 sm:pt-20">
          <Eyebrow>Auto Market · Rahim Yar Khan</Eyebrow>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">What makes {BUSINESS.name} special</h1>
          <p className="mt-3 text-sm text-muted-foreground sm:text-base">New and used motorcycles, every model and colour in one showroom.</p>

          <BikeArt className="mt-10 w-full max-w-2xl animate-in fade-in-0 zoom-in-95 duration-700" />

          <div className="mt-10 grid w-full max-w-2xl grid-cols-2 gap-y-8 sm:grid-cols-4">
            {STATS.map((s) => (
              <Stat key={s.label} {...s} />
            ))}
          </div>

          <div className="mt-12 flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
            <Link href="/showroom" className="group inline-flex items-center gap-2 border-b border-foreground pb-1 text-sm font-medium">
              Explore the showroom in 3D
              <ArrowRightIcon className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a href={tel(BUSINESS.owner.phone)} className="group inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <PhoneIcon className="size-4" />
              <span>
                Call the owner <span className="font-medium text-foreground tabular-nums">{BUSINESS.owner.phone}</span>
              </span>
            </a>
          </div>
        </div>
      </section>

      <Lineup />

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

      <Offer />

      {/* Timeline */}
      <section className="bg-[oklch(0.13_0_0)] text-white">
        <div className="mx-auto w-full max-w-6xl px-5 pt-20 pb-24 sm:px-8">
          <h2 className="text-center font-condensed text-3xl font-light tracking-[0.12em] uppercase sm:text-5xl">Your ride, step by step</h2>
          <div className="mt-12">
            <RideTimeline />
          </div>
        </div>
      </section>

      <Faq />

      {/* Visit: owner contact first */}
      <section id="visit" className="scroll-mt-14 border-t bg-[oklch(0.97_0.004_264)]">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-20 sm:px-8 lg:grid-cols-2 lg:items-end">
          <div>
            <p lang="ur" dir="rtl" className="text-right text-3xl lg:text-left">
              {BUSINESS.nameUrdu}
            </p>
            <h2 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Visit the showroom</h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">
              Every model and colour is waiting for you. Drop in, or call the owner before you come.
            </p>
            <a
              href={tel(BUSINESS.owner.phone)}
              className="mt-8 inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-6 text-sm font-medium text-background transition-opacity hover:opacity-90"
            >
              <PhoneIcon className="size-4" /> Call {BUSINESS.owner.name}
            </a>
          </div>
          <div className="divide-y border-y text-sm">
            <RowLink href={tel(BUSINESS.owner.phone)} label={`Owner · ${BUSINESS.owner.name}`} value={BUSINESS.owner.phone} big />
            <RowLink href={mapsUrl} label="Address" value={BUSINESS.address} external />
          </div>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
