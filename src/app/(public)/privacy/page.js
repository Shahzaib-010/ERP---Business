import Link from "next/link";
import { BUSINESS } from "@/lib/business";
import { PageShell, Prose, tel } from "../_landing/public-chrome";

export const metadata = {
  title: "Privacy policy",
  description: `How ${BUSINESS.name} collects, uses and protects personal information.`,
};

const UPDATED = "13 November 2026";

export default function PrivacyPage() {
  return (
    <PageShell eyebrow="Legal" title="Privacy policy" lead={`Last updated ${UPDATED}. This policy explains what information ${BUSINESS.name} keeps about you, why, and how it is protected.`}>
      <Prose>
        <h2>Who we are</h2>
        <p>
          {BUSINESS.name} is a motorcycle showroom at {BUSINESS.address}. The business is run by {BUSINESS.owner.name}, who is
          responsible for the information described here. You can reach the owner on{" "}
          <a href={tel(BUSINESS.owner.phone)}>{BUSINESS.owner.phone}</a>.
        </p>

        <h2>Visiting this website</h2>
        <p>
          You can browse the home page, the 3D showroom and the other public pages without giving us any personal information.
          We do not use advertising or tracking cookies, and we do not run third-party analytics on this website.
        </p>
        <p>
          The contact page shows an embedded Google Map. When it loads, Google may receive your device&apos;s technical details
          under its own privacy policy.
        </p>

        <h2>Information we keep about customers</h2>
        <p>When you buy from us or sell a motorcycle to us, we record the details needed for that sale, such as:</p>
        <ul>
          <li>your name, father&apos;s or husband&apos;s name and CNIC number;</li>
          <li>phone numbers and addresses;</li>
          <li>details of the motorcycle, the sale and the payments made;</li>
          <li>copies of documents for the sale, such as your CNIC, agreement and registration or transfer papers.</li>
        </ul>
        <p>We collect this from you in person at the showroom.</p>

        <h2>Why we use it</h2>
        <ul>
          <li>to complete the sale or purchase of a motorcycle and keep a correct record of it;</li>
          <li>to keep accurate accounts, receipts and payment records;</li>
          <li>to contact you about your purchase or account;</li>
          <li>to meet legal, tax and registration requirements.</li>
        </ul>
        <p>We do not sell your information, and we do not use it for marketing by other companies.</p>

        <h2>Customer login</h2>
        <p>
          If the showroom has set up an online account for you, you sign in with your CNIC and a password. When you sign in we
          set one cookie that keeps you logged in; it is needed for the login to work and is removed when you log out or the
          session ends. Your account shows your own records only, and never shows your private documents.
        </p>

        <h2>How we protect it</h2>
        <ul>
          <li>Only authorised showroom staff can see customer records, and each person sees only what their role allows.</li>
          <li>Passwords are stored in a scrambled (hashed) form that cannot be read back, not even by us.</li>
          <li>Documents are kept in private storage and open only for signed-in staff with permission.</li>
          <li>Important actions on records are logged, so changes can be traced.</li>
          <li>Financial records are kept, not deleted, so that accounts stay correct.</li>
        </ul>

        <h2>Who we share it with</h2>
        <p>
          We share information only when we have to: with government or registration authorities when the law requires it, and
          with the service providers that host our system and store its data on our behalf. They may not use it for anything
          else.
        </p>

        <h2>How long we keep it</h2>
        <p>
          We keep sale and payment records for as long as they are needed for the business&apos;s accounts and for any legal
          or tax requirement.
        </p>

        <h2>Your choices</h2>
        <p>
          You can ask to see the information we hold about you, or ask us to correct anything that is wrong. Visit the showroom
          or call {BUSINESS.owner.name} on <a href={tel(BUSINESS.owner.phone)}>{BUSINESS.owner.phone}</a>. We may ask you to
          confirm who you are first.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          If we change this policy, we will update it on this page and change the date at the top. See also our{" "}
          <Link href="/terms">terms of use</Link>.
        </p>
      </Prose>
    </PageShell>
  );
}
