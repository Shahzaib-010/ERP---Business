import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/server/auth/current";
import { getPaymentReceipt } from "@/server/services/receipts";
import { NotFoundError } from "@/server/errors";
import { formatBusinessDate } from "@/lib/business-date";
import { formatPhone } from "@/lib/phone";
import { PrintToolbar } from "../../print-toolbar";
import { Details, ReceiptSheet, SectionLabel, pkr, readSize } from "../../receipt-sheet";

export const metadata = { title: "Receipt" };

export default function PaymentReceiptPage({ params, searchParams }) {
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
    r = await getPaymentReceipt(actor, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const c = r.customer;
  const p = r.plan;
  return (
    <>
      <PrintToolbar size={size} backHref={`/plans/${p.id}`} backLabel={`Back to plan #${p.accountNumber}`} />
      <ReceiptSheet
        size={size}
        title={r.title}
        number={r.receiptNumber}
        date={r.date}
        amount={r.amount}
        voided={r.status === "voided"}
        voidReason={r.voidReason}
        footerLeft={<span>Customer signature</span>}
        footerRight={<span>Received by{r.receivedBy ? `: ${r.receivedBy}` : ""}</span>}
      >
        <section>
          <SectionLabel size={size}>Received from</SectionLabel>
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
          <SectionLabel size={size}>Installment account</SectionLabel>
          <Details
            size={size}
            rows={[
              { label: "Account no.", value: `#${p.accountNumber}`, mono: true },
              { label: "Item", value: p.item },
              { label: "Registration / serial", value: p.serial, mono: true },
              { label: "Total price", value: pkr(p.agreedTotal) },
              { label: "Balance before", value: pkr(p.balanceBefore) },
              { label: "This payment", value: pkr(r.amount) },
              { label: "Balance after", value: pkr(p.balanceAfter) },
              { label: "Next installment", value: p.nextDue && r.status === "posted" ? `${pkr(p.nextDue.amount)} by ${formatBusinessDate(p.nextDue.dueDate)}` : null },
            ]}
          />
        </section>
        {r.note && <p className="text-neutral-600">Note: {r.note}</p>}
      </ReceiptSheet>
    </>
  );
}
