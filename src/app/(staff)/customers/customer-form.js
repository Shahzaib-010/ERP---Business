"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Alert, Field, Input, buttonClass, inputClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

const PHONE_SLOTS = 3;

/**
 * Add (no `customer`) or edit (with `customer`) a customer.
 * `action` is a Server Action, already bound to the customer id when editing.
 */
export function CustomerForm({ action, customer, cancelHref }) {
  const isEdit = Boolean(customer);
  const [state, formAction] = useActionState(action, null);
  const values = state?.values ?? customer ?? {};
  const errors = state?.fieldErrors ?? {};
  const phones = Array.from({ length: PHONE_SLOTS }, (_, i) => values.phones?.[i] ?? "");
  const phoneError =
    errors.phones ?? Object.entries(errors).find(([k]) => k.startsWith("phones."))?.[1];

  const text = (name, label, { hint, ...props } = {}) => (
    <Field label={label} name={name} error={errors[name]} hint={hint}>
      <Input name={name} defaultValue={values[name] ?? ""} error={errors[name]} {...props} />
    </Field>
  );
  const area = (name, label) => (
    <Field label={label} name={name} error={errors[name]}>
      <textarea
        id={name}
        name={name}
        rows={2}
        defaultValue={values[name] ?? ""}
        aria-invalid={errors[name] ? true : undefined}
        className={inputClass}
      />
    </Field>
  );

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <Alert>{state && !state.ok ? state.error : null}</Alert>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Identity</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {text("name", "Name *", { autoComplete: "off" })}
          {text("fatherOrHusbandName", "Father's / husband's name")}
          {text("cnic", "CNIC *", {
            inputMode: "numeric",
            placeholder: "31303-1234567-1",
            hint: "13 digits. Each CNIC can belong to one customer only.",
            autoComplete: "off",
          })}
          {text("caste", "Caste / tribe")}
          {text("profession", "Profession")}
          {text("designation", "Designation / job title")}
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Phone numbers</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {phones.map((p, i) => (
            <div key={i} className="space-y-1">
              <label htmlFor={`phone-${i}`} className="block text-sm font-medium text-slate-800">
                {i === 0 ? "Mobile" : `Other number ${i}`}
              </label>
              <input
                id={`phone-${i}`}
                name="phones"
                inputMode="tel"
                placeholder="0300-1234567"
                defaultValue={p}
                aria-invalid={phoneError ? true : undefined}
                className={inputClass}
              />
            </div>
          ))}
        </div>
        {phoneError && <p className="text-xs text-red-700">{phoneError}</p>}
      </section>

      <section className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Addresses</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {area("homeAddress", "Home (permanent) address")}
          {area("collectionAddress", "Installment collection address")}
          {area("businessAddress", "Business / office address")}
          {area("notes", "Notes")}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <SubmitButton>{isEdit ? "Save changes" : "Add customer"}</SubmitButton>
        {cancelHref && (
          <Link href={cancelHref} className={buttonClass("secondary")}>
            Cancel
          </Link>
        )}
      </div>
    </form>
  );
}
