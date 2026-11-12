// Print pages (receipts, vouchers): no app chrome. Always light, whatever the app theme,
// because they are printed on white paper.
export default function PrintLayout({ children }) {
  return <div className="print-root min-h-svh flex-1 bg-neutral-200 text-neutral-900 print:bg-white">{children}</div>;
}
