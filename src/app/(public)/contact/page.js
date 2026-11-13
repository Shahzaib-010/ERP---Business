import { ArrowUpRightIcon, MapPinIcon, PhoneIcon } from "lucide-react";
import { BUSINESS } from "@/lib/business";
import { PageShell, mapsUrl, tel } from "../_landing/public-chrome";

export const metadata = {
  title: "Contact",
  description: `Call ${BUSINESS.owner.name} on ${BUSINESS.owner.phone} or visit ${BUSINESS.name} in the Auto Market, Rahim Yar Khan.`,
};

const mapEmbed = `https://www.google.com/maps?q=${encodeURIComponent(BUSINESS.mapLocation)}&z=17&output=embed`;

export default function ContactPage() {
  return (
    <PageShell
      active="contact"
      eyebrow="Contact"
      title="Talk to the owner"
      lead="The quickest way to ask about a bike, a price or what is in stock today is to call. Or drop in at the showroom."
    >
      <section className="mx-auto grid w-full max-w-6xl gap-12 px-5 py-16 sm:px-8 lg:grid-cols-2">
        <div className="divide-y border-y">
          <a href={tel(BUSINESS.owner.phone)} className="group flex items-center justify-between gap-4 py-7">
            <span className="flex items-start gap-4">
              <PhoneIcon className="mt-1 size-5 text-muted-foreground" />
              <span>
                <span className="block text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">Owner · {BUSINESS.owner.name}</span>
                <span className="mt-1 block font-condensed text-4xl font-semibold tabular-nums">{BUSINESS.owner.phone}</span>
              </span>
            </span>
            <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
          </a>
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="group flex items-center justify-between gap-4 py-7">
            <span className="flex items-start gap-4">
              <MapPinIcon className="mt-1 size-5 text-muted-foreground" />
              <span>
                <span className="block text-[0.7rem] tracking-[0.18em] text-muted-foreground uppercase">Showroom</span>
                <span className="mt-1 block text-base font-medium">{BUSINESS.address}</span>
                <span className="mt-1 block text-sm text-muted-foreground">Open in Google Maps</span>
              </span>
            </span>
            <ArrowUpRightIcon className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-foreground" />
          </a>
          <div className="py-7">
            <p lang="ur" dir="rtl" className="text-right text-2xl leading-loose lg:text-left">
              {BUSINESS.nameUrdu}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">Existing customers can also see their account through the customer login.</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border bg-muted">
          <iframe
            title={`Map to ${BUSINESS.name}`}
            src={mapEmbed}
            className="aspect-4/3 h-full min-h-72 w-full grayscale-[0.4]"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </section>
    </PageShell>
  );
}
