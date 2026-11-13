import { Suspense } from "react";
import { requireStaffPage } from "@/server/auth/current";
import { getDailyReport } from "@/server/services/reports";
import { ValidationError } from "@/server/errors";
import { auditActionLabel } from "@/lib/audit-labels";
import { BUSINESS } from "@/lib/business";
import { formatBusinessDate } from "@/lib/business-date";
import { formatPKR } from "@/lib/format";
import { ReportToolbar } from "../../report-toolbar";

export const metadata = { title: "Daily report" };

// Printable A4 daily report. Always light (plain greys), like the receipts.
const time = (d) => new Intl.DateTimeFormat("en-PK", { timeZone: "Asia/Karachi", hour: "numeric", minute: "2-digit" }).format(new Date(d));

export default function PrintDailyReportPage({ searchParams }) {
  return (
    <Suspense fallback={<p className="p-10 text-center text-sm text-neutral-500">Preparing report…</p>}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }) {
  const actor = await requireStaffPage("transactions.view");
  const sp = await searchParams;
  let r;
  try {
    r = await getDailyReport(actor, { date: typeof sp.date === "string" ? sp.date : undefined });
  } catch (err) {
    if (!(err instanceof ValidationError)) throw err;
    r = await getDailyReport(actor, {});
  }
  const m = r.money;

  return (
    <>
      <style>{`@page { size: A4; margin: 12mm; } @media print { html, body { background: #fff !important; } .print-root { background: #fff !important; } .sheet { box-shadow: none !important; margin: 0 !important; padding: 0 !important; width: auto !important; min-height: 0 !important; } tr, li { break-inside: avoid; } }`}</style>
      <ReportToolbar backHref={`/reports/daily?date=${r.date}`} excelHref={`/api/reports/daily?date=${r.date}`} autoPdf={sp.pdf === "1"} />

      <article className="sheet mx-auto my-6 w-[210mm] min-h-[297mm] bg-white p-[12mm] text-[11.5px] leading-snug shadow-lg">
        <header className="flex items-start justify-between gap-6 border-b-2 border-neutral-900 pb-3">
          <div>
            <h1 className="text-xl font-bold">{BUSINESS.name}</h1>
            <p className="text-neutral-600">{BUSINESS.address}</p>
          </div>
          <div className="text-right">
            <p className="text-base font-semibold">Daily report</p>
            <p className="text-sm">{formatBusinessDate(r.date)}</p>
            <p className="text-[10px] text-neutral-500">
              Printed {formatBusinessDate(r.generatedAt)} {time(r.generatedAt)}
              {r.isToday && " · day not finished"}
            </p>
          </div>
        </header>

        {/* Cash summary */}
        <Section title="Cash summary">
          <div className="grid grid-cols-4 border border-neutral-300">
            {[
              ["Cash at start", m.opening],
              ["Money in", m.cashIn],
              ["Money out", m.cashOut],
              ["Cash at end", m.closing],
            ].map(([label, value], i) => (
              <div key={label} className={`px-3 py-2 ${i > 0 ? "border-l border-neutral-300" : ""} ${i === 3 ? "bg-neutral-100" : ""}`}>
                <p className="text-[10px] tracking-wide text-neutral-500 uppercase">{label}</p>
                <p className="text-sm font-semibold tabular-nums">{formatPKR(value)}</p>
              </div>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-4">
            <Parts
              title="Money in"
              rows={[
                ["Installments & advances", m.parts.installments],
                ["Cash bike sales", m.parts.bikeCashSales],
                ["Other income", m.parts.otherIncome],
                ["Owner investment", m.parts.ownerInvestment],
              ]}
              total={m.cashIn}
            />
            <Parts
              title="Money out"
              rows={[
                ["Payments to sellers", m.parts.sellerPayments],
                ["Expenses", m.parts.expenses],
                ["Owner withdrawal", m.parts.ownerWithdrawal],
                ["Items bought for plans", m.parts.itemPurchases],
              ]}
              total={m.cashOut}
            />
          </div>
        </Section>

        {/* Cash movements */}
        <Section title={`Cash movements (${r.entries.length})`}>
          {r.entries.length === 0 ? (
            <p className="text-neutral-500">No money came in or went out on this day.</p>
          ) : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-y border-neutral-400 text-left text-[10px] tracking-wide text-neutral-600 uppercase">
                  <th className="py-1 pr-2 font-medium">Type</th>
                  <th className="py-1 pr-2 font-medium">Details</th>
                  <th className="py-1 pr-2 font-medium">Reference</th>
                  <th className="py-1 pr-2 text-right font-medium">In</th>
                  <th className="py-1 text-right font-medium">Out</th>
                </tr>
              </thead>
              <tbody>
                {r.entries.map((e) => (
                  <tr key={e.id} className="border-b border-neutral-200 align-top">
                    <td className="py-1 pr-2 whitespace-nowrap">{e.categoryLabel ? `${e.sourceLabel}: ${e.categoryLabel}` : e.sourceLabel}</td>
                    <td className="py-1 pr-2">
                      <span className="font-medium">{e.title}</span>
                      {e.detail && <span className="text-neutral-600"> — {e.detail}</span>}
                    </td>
                    <td className="py-1 pr-2 whitespace-nowrap text-neutral-600">{e.reference ?? ""}</td>
                    <td className="py-1 pr-2 text-right whitespace-nowrap tabular-nums">{e.direction === "in" ? formatPKR(e.amount) : ""}</td>
                    <td className="py-1 text-right whitespace-nowrap tabular-nums">{e.direction === "out" ? formatPKR(e.amount) : ""}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-neutral-400 font-semibold">
                  <td className="py-1 pr-2" colSpan={3}>
                    Total
                  </td>
                  <td className="py-1 pr-2 text-right tabular-nums">{formatPKR(m.cashIn)}</td>
                  <td className="py-1 text-right tabular-nums">{formatPKR(m.cashOut)}</td>
                </tr>
              </tbody>
            </table>
          )}
        </Section>

        {/* New records */}
        <Section title="New records">
          {[r.customers, r.plans, r.bikesBought, r.bikesSold].every((l) => !l?.length) ? (
            <p className="text-neutral-500">Nothing new was added on this day.</p>
          ) : (
            <ul className="space-y-0.5">
              {r.customers?.map((c) => (
                <li key={c.id}>
                  <b>New customer:</b> {c.name}
                </li>
              ))}
              {r.plans?.map((p) => (
                <li key={p.id}>
                  <b>New plan #{p.accountNumber}:</b> {p.customerName} — {p.item}, total {formatPKR(p.agreedTotal)}, advance {formatPKR(p.advance)}
                </li>
              ))}
              {r.bikesBought?.map((b) => (
                <li key={b.id}>
                  <b>Bike bought B-{b.bikeNumber}:</b> {b.label} from {b.seller} for {formatPKR(b.price)}
                  {b.owed ? `, still owed ${formatPKR(b.owed)}` : ""}
                </li>
              ))}
              {r.bikesSold?.map((b) => (
                <li key={b.id}>
                  <b>Bike sold B-{b.bikeNumber}:</b> {b.label} to {b.customerName} ({b.mode === "cash" ? "cash" : "installments"}) for {formatPKR(b.price)}
                </li>
              ))}
            </ul>
          )}
        </Section>

        {/* Activity */}
        {r.activity && (
          <Section title={r.activityTotal > r.activity.length ? `Activity log (latest ${r.activity.length} of ${r.activityTotal})` : `Activity log (${r.activity.length})`}>
            {r.activity.length === 0 ? (
              <p className="text-neutral-500">No activity on this day.</p>
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-y border-neutral-400 text-left text-[10px] tracking-wide text-neutral-600 uppercase">
                    <th className="py-1 pr-2 font-medium">Time</th>
                    <th className="py-1 pr-2 font-medium">Staff</th>
                    <th className="py-1 pr-2 font-medium">Action</th>
                    <th className="py-1 font-medium">Record</th>
                  </tr>
                </thead>
                <tbody>
                  {r.activity.map((a) => (
                    <tr key={a.id} className="border-b border-neutral-200 align-top">
                      <td className="py-1 pr-2 whitespace-nowrap tabular-nums">{time(a.createdAt)}</td>
                      <td className="py-1 pr-2 whitespace-nowrap">{a.actorName}</td>
                      <td className="py-1 pr-2">
                        {auditActionLabel(a.action)}
                        {a.reason && <span className="text-neutral-600"> — “{a.reason}”</span>}
                      </td>
                      <td className="py-1">{a.entityName ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Section>
        )}

        <footer className="mt-8 grid grid-cols-2 gap-10 text-neutral-600">
          <p className="border-t border-neutral-400 pt-1">Prepared by</p>
          <p className="border-t border-neutral-400 pt-1">Checked by</p>
        </footer>
        <p className="mt-4 text-[10px] text-neutral-500">Cash in hand counts only what is recorded in the system. Settlement discounts are not cash and are not included.</p>
      </article>
    </>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-5">
      <h2 className="mb-1.5 text-[11px] font-semibold tracking-wider text-neutral-700 uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Parts({ title, rows, total }) {
  return (
    <table className="w-full border-collapse">
      <tbody>
        <tr>
          <td colSpan={2} className="pb-0.5 text-[10px] tracking-wide text-neutral-500 uppercase">
            {title}
          </td>
        </tr>
        {rows.map(([label, value]) => (
          <tr key={label} className="border-b border-neutral-200">
            <td className="py-0.5">{label}</td>
            <td className="py-0.5 text-right tabular-nums">{formatPKR(value)}</td>
          </tr>
        ))}
        <tr className="font-semibold">
          <td className="py-0.5">Total</td>
          <td className="py-0.5 text-right tabular-nums">{formatPKR(total)}</td>
        </tr>
      </tbody>
    </table>
  );
}
