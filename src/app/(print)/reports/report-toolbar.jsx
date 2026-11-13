"use client";

import { useEffect } from "react";
import { ArrowLeftIcon, DownloadIcon, FileTextIcon, PrinterIcon } from "lucide-react";

/**
 * Back · Excel · Save as PDF · Print. Hidden when printing.
 * "Save as PDF" opens the browser's print dialog, where "Save as PDF" is a printer choice;
 * with `autoPdf` it opens straight away (the PDF button on the report page).
 */
export function ReportToolbar({ backHref, excelHref, autoPdf }) {
  useEffect(() => {
    if (!autoPdf) return;
    const t = setTimeout(() => window.print(), 400);
    return () => clearTimeout(t);
  }, [autoPdf]);

  return (
    <div className="sticky top-0 z-10 border-b border-neutral-300 bg-white/90 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <a href={backHref} className="inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900">
          <ArrowLeftIcon className="size-4" /> Back to report
        </a>
        <div className="flex flex-wrap items-center gap-2">
          <a href={excelHref} className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50">
            <DownloadIcon className="size-4" /> Excel
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            title="In the print window, choose “Save as PDF” as the printer"
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            <FileTextIcon className="size-4" /> Save as PDF
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-[oklch(0.34_0.09_264)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
          >
            <PrinterIcon className="size-4" /> Print
          </button>
        </div>
      </div>
      {autoPdf && (
        <p className="border-t border-neutral-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900">
          In the print window, choose <strong>Save as PDF</strong> as the printer (destination), then Save.
        </p>
      )}
    </div>
  );
}
