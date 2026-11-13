"use client";

import { useActionState } from "react";
import Link from "next/link";
import { IdCardIcon, MapPinIcon, PhoneIcon, SaveIcon, UserPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FieldError } from "@/components/ui/field";
import { FormAlert } from "@/components/app/form-alert";
import { TextField, TextareaField, formatCnicInput, formatPhoneInput } from "@/components/app/form-fields";
import { SubmitButton } from "@/components/submit-button";

const PHONE_SLOTS = 3;

function Section({ icon: Icon, title, description, children }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-primary" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

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
  const phoneError = errors.phones ?? Object.entries(errors).find(([k]) => k.startsWith("phones."))?.[1];
  // Remount inputs after a failed submit so they show the values that were sent back.
  const formKey = state ? JSON.stringify(state.values ?? {}) : "initial";

  const text = (name, label, props = {}) => (
    <TextField name={name} label={label} defaultValue={values[name] ?? ""} error={errors[name]} {...props} />
  );

  return (
    <form key={formKey} action={formAction} className="flex flex-col gap-6" noValidate>
      <FormAlert>{state && !state.ok ? state.error : null}</FormAlert>

      <Section icon={IdCardIcon} title="Identity" description="As written on the CNIC card and the agreement form.">
        <div className="grid gap-5 sm:grid-cols-2">
          {text("name", "Full name", { required: true, autoComplete: "off", autoFocus: !isEdit })}
          {text("fatherOrHusbandName", "Father's / husband's name", { autoComplete: "off" })}
          {text("cnic", "CNIC number", {
            required: true,
            inputMode: "numeric",
            placeholder: "31303-1234567-1",
            autoComplete: "off",
            hint: "13 digits. Each CNIC belongs to one customer only.",
            onChange: (e) => (e.target.value = formatCnicInput(e.target.value)),
            inputClassName: "font-mono",
          })}
          {text("caste", "Caste / tribe")}
          {text("profession", "Profession")}
          {text("designation", "Designation / job title")}
        </div>
      </Section>

      <Section icon={PhoneIcon} title="Phone numbers" description="The first number is used for calls and reminders.">
        <div className="grid gap-5 sm:grid-cols-3">
          {phones.map((p, i) => (
            <TextField
              key={i}
              id={`phone-${i}`}
              name="phones"
              label={i === 0 ? "Mobile" : `Other number ${i}`}
              inputMode="tel"
              placeholder="0300-1234567"
              defaultValue={p}
              inputClassName="font-mono"
              onChange={(e) => (e.target.value = formatPhoneInput(e.target.value))}
            />
          ))}
        </div>
        {phoneError && <FieldError className="mt-3">{phoneError}</FieldError>}
        <div className="mt-5 grid gap-5 border-t pt-5 sm:grid-cols-3">
          <div className="flex flex-col gap-2">
            <TextField
              id="whatsapp"
              name="whatsapp"
              label="WhatsApp number"
              inputMode="tel"
              placeholder="0300-1234567"
              defaultValue={values.whatsapp ?? ""}
              error={errors.whatsapp}
              hint="Leave empty if they don't use WhatsApp."
              inputClassName="font-mono"
              onChange={(e) => (e.target.value = formatPhoneInput(e.target.value))}
            />
            <button
              type="button"
              className="w-fit text-xs font-medium text-primary hover:underline"
              onClick={() => {
                const mobile = document.getElementById("phone-0")?.value ?? "";
                const wa = document.getElementById("whatsapp");
                if (wa && mobile) wa.value = mobile;
              }}
            >
              Same as mobile
            </button>
          </div>
        </div>
      </Section>

      <Section icon={MapPinIcon} title="Addresses and notes">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextareaField name="homeAddress" label="Home (permanent) address" defaultValue={values.homeAddress ?? ""} error={errors.homeAddress} />
          <TextareaField
            name="collectionAddress"
            label="Installment collection address"
            hint="Leave empty if it is the same as the home address."
            defaultValue={values.collectionAddress ?? ""}
            error={errors.collectionAddress}
          />
          <TextareaField name="businessAddress" label="Business / office address" defaultValue={values.businessAddress ?? ""} error={errors.businessAddress} />
          <TextareaField name="notes" label="Notes" defaultValue={values.notes ?? ""} error={errors.notes} />
        </div>
      </Section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:justify-end sm:rounded-xl sm:border">
        {cancelHref && (
          <Button variant="outline" asChild>
            <Link href={cancelHref}>Cancel</Link>
          </Button>
        )}
        <SubmitButton icon={isEdit ? SaveIcon : UserPlusIcon}>{isEdit ? "Save changes" : "Add customer"}</SubmitButton>
      </div>
    </form>
  );
}
