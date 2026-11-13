import "server-only";
import writeExcelFile from "write-excel-file/node";
import { auditActionLabel } from "@/lib/audit-labels";
import { BUSINESS } from "@/lib/business";
import { formatBusinessDate } from "@/lib/business-date";

// The daily report as a real .xlsx file (opens in Excel, Google Sheets, LibreOffice).
// Sheets: Summary, Cash movements, New records, Activity. Money stays numeric so the
// owner can add it up; it is shown with thousand separators.

const MONEY = "#,##0";
const head = (labels) => labels.map((value) => ({ value, fontWeight: "bold", backgroundColor: "#EEF0F4" }));
const money = (value) => ({ value: value ?? 0, type: Number, format: MONEY });
const time = (d) => new Intl.DateTimeFormat("en-PK", { timeZone: "Asia/Karachi", hour: "numeric", minute: "2-digit" }).format(new Date(d));

export async function dailyReportWorkbook(r) {
  const title = `${BUSINESS.name} — daily report ${formatBusinessDate(r.date)}`;
  const m = r.money;

  const summary = [
    [{ value: title, fontWeight: "bold", fontSize: 13 }],
    [],
    head(["Cash", "Amount (Rs)"]),
    ["Cash in hand at start of day", money(m.opening)],
    ["Money in", money(m.cashIn)],
    ["Money out", money(m.cashOut)],
    ["Net for the day", money(m.net)],
    [{ value: "Cash in hand at end of day", fontWeight: "bold" }, { ...money(m.closing), fontWeight: "bold" }],
    [],
    head(["Money in by type", "Amount (Rs)"]),
    ["Installments and advances", money(m.parts.installments)],
    ["Cash bike sales", money(m.parts.bikeCashSales)],
    ["Other income", money(m.parts.otherIncome)],
    ["Owner investment", money(m.parts.ownerInvestment)],
    [],
    head(["Money out by type", "Amount (Rs)"]),
    ["Payments to sellers", money(m.parts.sellerPayments)],
    ["Expenses", money(m.parts.expenses)],
    ["Owner withdrawal", money(m.parts.ownerWithdrawal)],
    ["Items bought for plans", money(m.parts.itemPurchases)],
    [],
    [{ value: `Generated ${formatBusinessDate(r.generatedAt)} ${time(r.generatedAt)}. Cash in hand counts only what is recorded in the system.`, fontStyle: "italic" }],
  ];

  const movements = [
    head(["Type", "Details", "Reference", "Money in (Rs)", "Money out (Rs)"]),
    ...r.entries.map((e) => [
      e.categoryLabel ? `${e.sourceLabel}: ${e.categoryLabel}` : e.sourceLabel,
      [e.title, e.detail].filter(Boolean).join(" — "),
      e.reference ?? "",
      e.direction === "in" ? money(e.amount) : null,
      e.direction === "out" ? money(e.amount) : null,
    ]),
    [{ value: "Total", fontWeight: "bold" }, null, null, { ...money(m.cashIn), fontWeight: "bold" }, { ...money(m.cashOut), fontWeight: "bold" }],
  ];

  const records = [head(["Record", "Details", "Amount (Rs)"])];
  for (const c of r.customers ?? []) records.push(["New customer", c.name, null]);
  for (const p of r.plans ?? []) records.push([`New plan #${p.accountNumber}`, `${p.customerName} — ${p.item} (advance Rs ${p.advance.toLocaleString("en-PK")})`, money(p.agreedTotal)]);
  for (const b of r.bikesBought ?? []) records.push([`Bike bought B-${b.bikeNumber}`, `${b.label} from ${b.seller}${b.owed ? ` (owed Rs ${b.owed.toLocaleString("en-PK")})` : ""}`, money(b.price)]);
  for (const b of r.bikesSold ?? []) records.push([`Bike sold B-${b.bikeNumber}`, `${b.label} to ${b.customerName} (${b.mode === "cash" ? "cash" : "installments"})`, money(b.price)]);
  if (records.length === 1) records.push(["Nothing new on this day", "", null]);

  const sheets = [
    { data: summary, sheet: "Summary", columns: [{ width: 42 }, { width: 18 }] },
    { data: movements, sheet: "Cash movements", columns: [{ width: 30 }, { width: 50 }, { width: 18 }, { width: 16 }, { width: 16 }], stickyRowsCount: 1 },
    { data: records, sheet: "New records", columns: [{ width: 24 }, { width: 64 }, { width: 16 }], stickyRowsCount: 1 },
  ];
  if (r.activity) {
    sheets.push({
      data: [
        head(["Time", "Staff", "Action", "Record", "Reason"]),
        ...r.activity.map((a) => [time(a.createdAt), a.actorName, auditActionLabel(a.action), a.entityName ?? "", a.reason ?? ""]),
      ],
      sheet: "Activity",
      columns: [{ width: 10 }, { width: 22 }, { width: 32 }, { width: 28 }, { width: 40 }],
      stickyRowsCount: 1,
    });
  }
  return writeExcelFile(sheets).toBuffer();
}
