"use client";

import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** Label + input + hint + error, wired up for accessibility. */
export function TextField({ name, label, error, hint, required, className, inputClassName, id, ...props }) {
  const inputId = id ?? name;
  return (
    <Field data-invalid={error ? true : undefined} className={className}>
      <FieldLabel htmlFor={inputId}>
        {label}
        {required && <span className="text-destructive">*</span>}
      </FieldLabel>
      <Input
        id={inputId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined}
        className={inputClassName}
        {...props}
      />
      {hint && !error && <FieldDescription id={`${inputId}-hint`}>{hint}</FieldDescription>}
      {error && <FieldError id={`${inputId}-error`}>{error}</FieldError>}
    </Field>
  );
}

export function TextareaField({ name, label, error, hint, className, rows = 3, ...props }) {
  return (
    <Field data-invalid={error ? true : undefined} className={className}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Textarea
        id={name}
        name={name}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${name}-error` : undefined}
        className="min-h-20 resize-y"
        {...props}
      />
      {hint && !error && <FieldDescription>{hint}</FieldDescription>}
      {error && <FieldError id={`${name}-error`}>{error}</FieldError>}
    </Field>
  );
}

/** As-you-type formatting: "3130312345671" -> "31303-1234567-1". */
export function formatCnicInput(value) {
  const d = value.replace(/\D/g, "").slice(0, 13);
  if (d.length <= 5) return d;
  if (d.length <= 12) return `${d.slice(0, 5)}-${d.slice(5)}`;
  return `${d.slice(0, 5)}-${d.slice(5, 12)}-${d.slice(12)}`;
}

/** "03001234567" -> "0300-1234567" for Pakistani mobiles; other input is left alone. */
export function formatPhoneInput(value) {
  if (/[^\d\s-]/.test(value)) return value; // "+92 …" etc.: leave as typed
  const d = value.replace(/\D/g, "");
  if (!d.startsWith("03")) return value;
  const cut = d.slice(0, 11);
  return cut.length <= 4 ? cut : `${cut.slice(0, 4)}-${cut.slice(4)}`;
}
