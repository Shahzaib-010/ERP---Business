import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireStaffPage } from "@/server/auth/current";
import { getCashbookVoucher } from "@/server/services/receipts";
import { NotFoundError } from "@/server/errors";
import { PrintToolbar } from "../../print-toolbar";
import { Details, ReceiptSheet, SectionLabel, readSize } from "../../receipt-sheet";

export const metadata = { title: "Voucher" };

export default function CashbookVoucherPage({ params, searchParams }) {
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
    v = await getCashbookVoucher(actor, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const out = v.direction === "out";
  return (
    <>
      <PrintToolbar size={size} backHref="/cashbook" backLabel="Back to cash book" />
      <ReceiptSheet
        size={size}
        title={v.title}
        number={v.voucherNumber}
        numberLabel="Voucher no."
        date={v.date}
        amount={v.amount}
        voided={v.status === "voided"}
        voidReason={v.voidReason}
        footerLeft={<span>{out ? "Received by" : "Paid by"}</span>}
        footerRight={<span>Entered by{v.enteredBy ? `: ${v.enteredBy}` : ""}</span>}
      >
        <section>
          <SectionLabel size={size}>{v.typeLabel}</SectionLabel>
          <Details
            size={size}
            rows={[
              { label: "Description", value: v.description, wide: true },
              { label: "Category", value: v.categoryLabel },
              { label: out ? "Paid to" : "Received from", value: v.party },
            ]}
          />
        </section>
      </ReceiptSheet>
    </>
  );
}
