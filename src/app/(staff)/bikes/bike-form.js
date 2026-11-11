"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { BikeIcon, ImagePlusIcon, PlusIcon, SaveIcon, StoreIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert } from "@/components/app/form-alert";
import { TextField, TextareaField, formatCnicInput, formatPhoneInput } from "@/components/app/form-fields";
import { SubmitButton } from "@/components/submit-button";
import { todayPk } from "@/lib/business-date";
import { formatPKR } from "@/lib/format";
import { MoneyField, SelectField, formatMoneyInput, moneyValue } from "../plans/plan-fields";

function Section({ icon: Icon, title, description, children }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-muted-foreground" /> {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const CONDITIONS = [
  { value: "new", label: "New" },
  { value: "used", label: "Used" },
];

/** Add a bike purchase (no `bike`) or edit a bike's details (with `bike`; prices are not editable). */
export function BikeForm({ action, bike, cancelHref, nextBikeNumber }) {
  const isEdit = Boolean(bike);
  const [state, formAction] = useActionState(action, null);
  const values = state?.values ?? bike ?? {};
  const errors = state?.fieldErrors ?? {};
  const key = state?.values ? JSON.stringify(state.values) : "initial";
  return <Inner key={key} {...{ isEdit, state, formAction, values, errors, cancelHref, nextBikeNumber }} />;
}

function Inner({ isEdit, state, formAction, values, errors, cancelHref, nextBikeNumber }) {
  const [price, setPrice] = useState(formatMoneyInput(values.purchasePrice));
  const [paid, setPaid] = useState(formatMoneyInput(values.paidNow));
  const owed = moneyValue(price) - moneyValue(paid);

  const t = (name, label, props = {}) => <TextField name={name} label={label} defaultValue={values[name] ?? ""} error={errors[name]} {...props} />;

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <FormAlert>{state && !state.ok ? state.error : null}</FormAlert>

      <Section icon={BikeIcon} title="Bike" description={isEdit ? undefined : `It will be stock number B-${nextBikeNumber}.`}>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {t("make", "Make", { required: true, placeholder: "e.g. Honda", autoFocus: !isEdit })}
          {t("model", "Model", { required: true, placeholder: "e.g. CD70 Dream" })}
          {t("modelYear", "Model year", { inputMode: "numeric", placeholder: "e.g. 2026" })}
          {t("color", "Colour", { placeholder: "e.g. Red" })}
          <SelectField name="condition" label="Condition" defaultValue={values.condition ?? "new"} options={CONDITIONS} error={errors.condition} />
          {t("registrationNumber", "Registration no.", { placeholder: "Optional, e.g. BJJ-4802", inputClassName: "font-mono uppercase" })}
          {t("engineNumber", "Engine no.", { placeholder: "Optional", inputClassName: "font-mono uppercase" })}
          {t("chassisNumber", "Chassis no.", { placeholder: "Optional", inputClassName: "font-mono uppercase" })}
        </div>
        <div className="mt-5">
          <TextareaField name="notes" label="Notes" rows={2} defaultValue={values.notes ?? ""} error={errors.notes} />
        </div>
      </Section>

      <Section icon={ImagePlusIcon} title="Photos" description="Optional.">
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/30 px-4 py-8 text-center">
          <ImagePlusIcon className="size-6 text-muted-foreground" />
          <p className="text-sm font-medium">Photo upload is coming</p>
          <p className="max-w-sm text-xs text-muted-foreground">
            Bike photos will be stored privately once file storage is set up (with receipts and documents). The bike can be saved without photos.
          </p>
        </div>
      </Section>

      <Section icon={StoreIcon} title="Bought from" description="The person or dealer the showroom bought the bike from.">
        <div className="grid gap-5 sm:grid-cols-2">
          {t("sellerName", "Seller name", { required: true })}
          {t("sellerPhone", "Phone", {
            inputMode: "tel",
            placeholder: "0300-1234567",
            inputClassName: "font-mono",
            onChange: (e) => (e.target.value = formatPhoneInput(e.target.value)),
          })}
          {t("sellerCnic", "CNIC", {
            inputMode: "numeric",
            placeholder: values.sellerCnicMasked ? `Saved: ${values.sellerCnicMasked}` : "Optional",
            inputClassName: "font-mono",
            hint: isEdit && values.sellerCnicMasked ? "Leave empty to keep the saved CNIC." : undefined,
            onChange: (e) => (e.target.value = formatCnicInput(e.target.value)),
          })}
          {t("sellerAddress", "Address")}
        </div>
      </Section>

      {!isEdit && (
        <Section icon={WalletIcon} title="Purchase" description="If you pay part now, the rest is recorded as owed to the seller.">
          <div className="grid gap-5 sm:grid-cols-3">
            <TextField name="purchaseDate" type="date" label="Purchase date" required defaultValue={values.purchaseDate ?? todayPk()} max={todayPk()} error={errors.purchaseDate} />
            <MoneyField name="purchasePrice" label="Purchase price" required value={price} onChange={setPrice} error={errors.purchasePrice} />
            <MoneyField name="paidNow" label="Paid to seller now" value={paid} onChange={setPaid} error={errors.paidNow} hint="0 if nothing paid yet." />
          </div>
          {moneyValue(price) > 0 && (
            <p className="mt-4 rounded-lg bg-muted/50 px-4 py-3 text-sm">
              {owed > 0 ? (
                <>
                  Still owed to the seller: <span className="font-semibold tabular-nums">{formatPKR(owed)}</span>
                </>
              ) : owed === 0 ? (
                "Paid in full."
              ) : (
                <span className="text-destructive">Paid now is more than the price.</span>
              )}
            </p>
          )}
        </Section>
      )}

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:justify-end sm:rounded-xl sm:border">
        <Button variant="outline" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <SubmitButton icon={isEdit ? SaveIcon : PlusIcon}>{isEdit ? "Save changes" : "Add bike"}</SubmitButton>
      </div>
    </form>
  );
}
