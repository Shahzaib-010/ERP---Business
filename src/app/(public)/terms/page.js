import Link from "next/link";
import { BUSINESS } from "@/lib/business";
import { PageShell, Prose, tel } from "../_landing/public-chrome";

export const metadata = {
  title: "Terms of use",
  description: `Terms for using the ${BUSINESS.name} website.`,
};

const UPDATED = "13 November 2026";

export default function TermsPage() {
  return (
    <PageShell eyebrow="Legal" title="Terms of use" lead={`Last updated ${UPDATED}. By using this website you agree to these terms.`}>
      <Prose>
        <h2>About this website</h2>
        <p>
          This website belongs to {BUSINESS.name}, {BUSINESS.address}. It introduces our motorcycle showroom and gives existing
          customers a way to view their account.
        </p>

        <h2>Bikes, colours and specifications</h2>
        <p>
          The models, colours, specifications and 3D views on this website are a guide only. The 3D bikes are illustrations,
          not photos of the actual motorcycles. Stock, colours and specifications can change without notice. Please check the
          bike in person at the showroom before you buy.
        </p>

        <h2>Prices and sales</h2>
        <p>
          This website does not sell motorcycles and does not show binding prices. Every sale or purchase is agreed in person at
          the showroom, and the written agreement and receipts given to you at that time are what count.
        </p>

        <h2>Customer login</h2>
        <ul>
          <li>Your login is for you only. Keep your password private and do not share it.</li>
          <li>Tell us straight away if you think someone else knows your password, so we can change it.</li>
          <li>The account view is for information. If something looks wrong, contact us; our records at the showroom are checked and corrected there.</li>
          <li>Do not try to access other people&apos;s records or the staff area. We may disable a login that is misused.</li>
        </ul>

        <h2>Acceptable use</h2>
        <p>
          Do not use the website in a way that breaks the law, harms the website or its data, or interferes with other people
          using it.
        </p>

        <h2>Content</h2>
        <p>
          The name {BUSINESS.name}, the logo, the text and the drawings on this website belong to the business. Please do not
          copy them for commercial use without our permission.
        </p>

        <h2>Availability</h2>
        <p>
          We try to keep the website working and accurate, but we cannot promise it will always be available or free of errors.
        </p>

        <h2>Privacy</h2>
        <p>
          How we handle personal information is explained in our <Link href="/privacy">privacy policy</Link>.
        </p>

        <h2>Governing law</h2>
        <p>These terms are governed by the laws of Pakistan.</p>

        <h2>Contact</h2>
        <p>
          Questions about these terms? Call {BUSINESS.owner.name} on <a href={tel(BUSINESS.owner.phone)}>{BUSINESS.owner.phone}</a>{" "}
          or visit the showroom.
        </p>
      </Prose>
    </PageShell>
  );
}
