import { BUSINESS } from "@/lib/business";
import { rupeesInWords } from "@/lib/amount-words";
import { formatBusinessDate } from "@/lib/business-date";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

// The printed sheet. Three layouts from one component: A4, A5 and thermal (80 mm roll).
// Plain neutral colours only: receipts are printed in black and white.

const PAGE = {
  a4: { css: "@page { size: A4; margin: 14mm; }", width: "w-[210mm] min-h-[297mm] p-[14mm]" },
  a5: { css: "@page { size: A5; margin: 10mm; }", width: "w-[148mm] min-h-[210mm] p-[10mm]" },
  thermal: { css: "@page { size: 80mm auto; margin: 3mm; }", width: "w-[80mm] p-[4mm]" },
};

export const pkr = (n) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;

export function ReceiptSheet({ size = "a5", title, number, numberLabel = "Receipt no.", date, amount, voided, voidReason, children, footerLeft, footerRight }) {
  const thermal = size === "thermal";
  const page = PAGE[size] ?? PAGE.a5;
  return (
    <>
      <style>{`${page.css} @media print { html, body { background: #fff !important; } .print-root { background: #fff !important; } }`}</style>
      <div className="flex justify-center px-4 py-8 print:block print:p-0">
        <article
          className={cn(
            "relative overflow-hidden bg-white text-neutral-900 shadow-xl print:w-auto print:min-h-0 print:p-0 print:shadow-none",
            page.width,
            thermal ? "font-mono text-[11px] leading-snug" : size === "a4" ? "text-[13px]" : "text-[12px]",
          )}
        >
          {voided && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden="true">
              <span className="-rotate-[24deg] rounded-xl border-[6px] border-red-600/60 px-6 text-7xl font-black tracking-widest text-red-600/45">VOID</span>
            </div>
          )}

          {/* Business header */}
          <header className={cn(thermal ? "border-b border-dashed border-neutral-400 pb-2 text-center" : "flex items-start justify-between gap-6 border-b-2 border-neutral-900 pb-4")}>
            <div className={thermal ? "" : "min-w-0"}>
              <p lang="ur" dir="rtl" className={cn("font-bold", thermal ? "text-lg leading-tight" : "text-2xl leading-tight")}>
                {BUSINESS.nameUrdu}
              </p>
              <p className={cn("font-bold tracking-tight", thermal ? "text-sm" : size === "a4" ? "text-xl" : "text-lg")}>{BUSINESS.name}</p>
              <p className="text-neutral-600">{BUSINESS.address}</p>
              <p className="text-neutral-600">{BUSINESS.contacts.map((c) => c.phone).join(" · ")}</p>
            </div>
            <div className={cn(thermal ? "mt-2" : "shrink-0 text-right")}>
              <p className={cn("font-bold uppercase tracking-wide", thermal ? "text-xs" : "text-base")}>{title}</p>
              <p className="mt-1">
                <span className="text-neutral-500">{numberLabel} </span>
                <span className="font-mono font-semibold">{number ?? "—"}</span>
              </p>
              <p>
                <span className="text-neutral-500">Date </span>
                <span className="font-medium">{formatBusinessDate(date)}</span>
              </p>
            </div>
          </header>

          {voided && (
            <p className="mt-3 rounded border border-red-300 bg-red-50 px-3 py-1.5 text-red-700">
              This entry was voided{voidReason ? `: ${voidReason}` : ""}. It is not a valid receipt.
            </p>
          )}

          <div className={cn(thermal ? "mt-2 space-y-2" : "mt-5 space-y-5")}>{children}</div>

          {/* Amount */}
          <div className={cn(thermal ? "mt-3 border-y border-dashed border-neutral-400 py-2 text-center" : "mt-6 flex items-center justify-between gap-6 rounded-lg border-2 border-neutral-900 px-5 py-4")}>
            <div className={thermal ? "" : "min-w-0"}>
              <p className="text-neutral-500 uppercase tracking-wide">Amount</p>
              <p className={cn("italic", thermal ? "" : "text-neutral-700")}>{rupeesInWords(amount)}</p>
            </div>
            <p className={cn("font-bold tabular-nums", thermal ? "mt-1 text-xl" : "shrink-0 text-3xl")}>{pkr(amount)}</p>
          </div>

          {/* Signatures */}
          <footer className={cn(thermal ? "mt-4 space-y-4 text-center" : "mt-12 grid grid-cols-2 gap-10")}>
            <div>
              <div className={cn("border-t border-neutral-500 pt-1", thermal && "mx-6")}>{footerLeft}</div>
            </div>
            <div className={thermal ? "" : "text-right"}>
              <div className={cn("border-t border-neutral-500 pt-1", thermal && "mx-6")}>{footerRight}</div>
            </div>
          </footer>
          <p className={cn("text-neutral-400", thermal ? "mt-4 text-center text-[9px]" : "mt-8 text-center text-[10px]")}>
            Computer-generated · printed {formatDateTime(new Date())} · {BUSINESS.name}
          </p>
        </article>
      </div>
    </>
  );
}

/** Two-column details list ("Account no." … "#1315"). */
export function Details({ rows, size }) {
  const thermal = size === "thermal";
  return (
    <dl className={cn(thermal ? "space-y-0.5" : "grid grid-cols-2 gap-x-8 gap-y-2")}>
      {rows
        .filter((r) => r && r.value !== null && r.value !== undefined && r.value !== "")
        .map((r) => (
          <div key={r.label} className={cn("flex justify-between gap-3", !thermal && "border-b border-neutral-200 pb-1.5", r.wide && !thermal && "col-span-2")}>
            <dt className="text-neutral-500">{r.label}</dt>
            <dd className={cn("text-right font-medium", r.mono && "font-mono")}>{r.value}</dd>
          </div>
        ))}
    </dl>
  );
}

export function SectionLabel({ children, size }) {
  return <p className={cn("font-semibold uppercase tracking-wide text-neutral-500", size === "thermal" ? "mt-2 border-t border-dashed border-neutral-300 pt-1 text-[10px]" : "text-[11px]")}>{children}</p>;
}

export function readSize(sp) {
  return ["a4", "a5", "thermal"].includes(sp?.size) ? sp.size : "a5";
}
