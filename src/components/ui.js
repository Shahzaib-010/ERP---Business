// Small shared UI pieces. Server- and client-safe (no hooks here).
import Link from "next/link";

export function Card({ className = "", children }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
      {children}
    </div>
  );
}

export function PageHeader({ title, description, action }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      </div>
      {action}
    </div>
  );
}

const buttonBase =
  "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60";
const variants = {
  primary: "bg-slate-900 text-white hover:bg-slate-700 focus-visible:ring-slate-900",
  secondary:
    "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 focus-visible:ring-slate-400",
  danger: "bg-red-600 text-white hover:bg-red-500 focus-visible:ring-red-600",
};

export function buttonClass(variant = "primary", className = "") {
  return `${buttonBase} ${variants[variant]} ${className}`;
}

export function ButtonLink({ href, variant = "primary", className = "", children }) {
  return (
    <Link href={href} className={buttonClass(variant, className)}>
      {children}
    </Link>
  );
}

export function Alert({ tone = "error", children }) {
  if (!children) return null;
  const tones = {
    error: "border-red-200 bg-red-50 text-red-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-slate-200 bg-slate-50 text-slate-700",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function Field({ label, name, error, hint, children }) {
  return (
    <div className="space-y-1">
      <label htmlFor={name} className="block text-sm font-medium text-slate-800">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-slate-500">{hint}</p>}
      {error && (
        <p id={`${name}-error`} className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 aria-invalid:border-red-500";

export function Input({ name, error, ...props }) {
  return (
    <input
      id={name}
      name={name}
      aria-invalid={error ? true : undefined}
      aria-describedby={error ? `${name}-error` : undefined}
      className={inputClass}
      {...props}
    />
  );
}

export function Badge({ tone = "slate", children }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700",
    green: "bg-emerald-100 text-emerald-800",
    red: "bg-red-100 text-red-800",
    blue: "bg-blue-100 text-blue-800",
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function LoadingBlock({ label = "Loading…" }) {
  return <p className="p-6 text-sm text-slate-500">{label}</p>;
}
