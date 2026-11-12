import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/server/auth/current";
import { getSellerVoucher } from "@/server/services/receipts";
import { NotFoundError } from "@/server/errors";
import { formatPhone } from "@/lib/phone";
import { PrintToolbar } from "../../print-toolbar";
import { Details, ReceiptSheet, SectionLabel, pkr, readSize } from "../../receipt-sheet";

export const metadata = { title: "Payment voucher" };

export default function SellerVoucherPage({ params, searchParams }) {
  return (
    <Suspense fallback={<p className="p-10 text-center text-sm text-neutral-500">Loading voucher…</p>}>
      <Content params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ params, searchParams }) {
  const actor = await requireStaffPage("receipts.view");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const size = readSize(sp);
  let v;
  try {
    v = await getSellerVoucher(actor, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  return (
    <>
      <PrintToolbar size={size} backHref={`/bikes/${v.bike.id}`} backLabel={`Back to B-${v.bike.bikeNumber}`} />
      <ReceiptSheet
        size={size}
        title={v.title}
        number={v.voucherNumber}
        numberLabel="Voucher no."
        date={v.date}
        amount={v.amount}
        voided={v.status === "voided"}
        voidReason={v.voidReason}
        footerLeft={<span>Received by (seller)</span>}
        footerRight={<span>Paid by{v.paidBy ? `: ${v.paidBy}` : ""}</span>}
      >
        <section>
          <SectionLabel size={size}>Paid to</SectionLabel>
          <Details
            size={size}
            rows={[
              { label: "Name", value: v.payee.name },
              { label: "CNIC", value: v.payee.cnicMasked, mono: true },
              { label: "Phone", value: v.payee.phone ? formatPhone(v.payee.phone) : null, mono: true },
            ]}
          />
        </section>
        <section>
          <SectionLabel size={size}>For</SectionLabel>
          <Details
            size={size}
            rows={[
              { label: "Purpose", value: v.purpose, wide: true },
              { label: "Purchase price", value: pkr(v.bike.purchasePrice) },
              { label: "Still owed after this", value: pkr(v.bike.owedAfter) },
            ]}
          />
        </section>
        {v.note && <p className="text-neutral-600">Note: {v.note}</p>}
      </ReceiptSheet>
    </>
  );
}
