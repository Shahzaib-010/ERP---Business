import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/server/auth/current";
import { getBikeSaleReceipt } from "@/server/services/receipts";
import { NotFoundError } from "@/server/errors";
import { formatPhone } from "@/lib/phone";
import { PrintToolbar } from "../../print-toolbar";
import { Details, ReceiptSheet, SectionLabel, readSize } from "../../receipt-sheet";

export const metadata = { title: "Sale receipt" };

export default function BikeSaleReceiptPage({ params, searchParams }) {
  return (
    <Suspense fallback={<p className="p-10 text-center text-sm text-neutral-500">Loading receipt…</p>}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ params, searchParams }) {
  const actor = await requireStaffPage("receipts.view");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const size = readSize(sp);
  let r;
  try {
    r = await getBikeSaleReceipt(actor, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const c = r.customer;
  const b = r.bike;
  return (
    <>
      <PrintToolbar size={size} backHref={`/bikes/${b.id}`} backLabel={`Back to B-${b.bikeNumber}`} />
      <ReceiptSheet
        size={size}
        title={r.title}
        number={r.receiptNumber}
        date={r.date}
        amount={r.amount}
        footerLeft={<span>Customer signature</span>}
        footerRight={<span>Received by{r.receivedBy ? `: ${r.receivedBy}` : ""}</span>}
      >
        <section>
          <SectionLabel size={size}>Sold to</SectionLabel>
          <Details
            size={size}
            rows={[
              { label: "Name", value: c?.name },
              { label: "Father / husband", value: c?.fatherOrHusbandName },
              { label: "CNIC", value: c?.cnicMasked, mono: true },
              { label: "Phone", value: c?.phone ? formatPhone(c.phone) : null, mono: true },
            ]}
          />
        </section>
        <section>
          <SectionLabel size={size}>Motorcycle</SectionLabel>
          <Details
            size={size}
            rows={[
              { label: "Make / model", value: `${b.make} ${b.model}` },
              { label: "Model year", value: b.modelYear },
              { label: "Colour", value: b.color },
              { label: "Condition", value: b.condition === "new" ? "New" : "Used" },
              { label: "Registration no.", value: b.registrationNumber, mono: true },
              { label: "Engine no.", value: b.engineNumber, mono: true },
              { label: "Chassis no.", value: b.chassisNumber, mono: true },
              { label: "Stock no.", value: `B-${b.bikeNumber}`, mono: true },
            ]}
          />
        </section>
        <p className="text-neutral-600">Paid in full in cash.{r.note ? ` Note: ${r.note}` : ""}</p>
      </ReceiptSheet>
    </>
  );
}
