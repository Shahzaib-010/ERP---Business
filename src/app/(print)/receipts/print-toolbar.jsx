"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeftIcon, PrinterIcon } from "lucide-react";

export const SIZES = [
  { value: "a4", label: "A4" },
  { value: "a5", label: "A5" },
  { value: "thermal", label: "Thermal 80 mm" },
];
const STORAGE_KEY = "receipt-size";

/** Paper size switch (remembered on this device), Print and Back. Hidden when printing. */
export function PrintToolbar({ size, backHref, backLabel = "Back" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  // Open with the size used last time on this device.
  useEffect(() => {
    if (params.get("size")) return;
    let saved = null;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {}
    if (saved && saved !== size && SIZES.some((s) => s.value === saved)) router.replace(`${pathname}?size=${saved}`);
  }, [params, pathname, router, size]);

  const choose = (value) => {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {}
    router.replace(`${pathname}?size=${value}`);
  };

  return (
    <div className="sticky top-0 z-10 border-b border-neutral-300 bg-white/90 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <a href={backHref} className="inline-flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900">
          <ArrowLeftIcon className="size-4" /> {backLabel}
        </a>
        <div className="flex items-center gap-3">
          <div className="flex gap-1 rounded-lg bg-neutral-100 p-1" role="radiogroup" aria-label="Paper size">
            {SIZES.map((s) => (
              <button
                key={s.value}
                type="button"
                role="radio"
                aria-checked={size === s.value}
                onClick={() => choose(s.value)}
                className={`rounded-md px-3 py-1 text-sm transition-colors ${size === s.value ? "bg-white font-medium shadow-sm" : "text-neutral-500 hover:text-neutral-900"}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-[oklch(0.34_0.09_264)] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
          >
            <PrinterIcon className="size-4" /> Print
          </button>
        </div>
      </div>
    </div>
  );
}
