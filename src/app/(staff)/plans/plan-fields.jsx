"use client";

import { useState } from "react";
import { PlusIcon, Trash2Icon, UserRoundCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TextField, TextareaField, formatCnicInput, formatPhoneInput } from "@/components/app/form-fields";
import { ITEM_KIND_LABELS } from "@/components/app/plan-ui";

/** "155000" -> "155,000" while typing. */
export function formatMoneyInput(value) {
  const digits = String(value ?? "").replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits ? Number(digits).toLocaleString("en-PK") : "";
}
export const moneyValue = (s) => {
  const d = String(s ?? "").replace(/\D/g, "");
  return d ? Number(d) : 0;
};

/**
 * D-019: what the business paid for the item (for profit) and whether that came out of
 * business cash (then a cash-out entry linked to the plan is recorded). Controlled.
 * alreadyPaid = a cash-out entry exists, so the tick is shown as done.
 */
export function ItemCostFields({ total, value, onChange, paid, onPaidChange, error, alreadyPaid }) {
  const cost = moneyValue(value);
  const profit = cost && total ? total - cost : null;
  return (
    <div className="mt-5 grid gap-5 border-t pt-5 sm:grid-cols-2">
      <MoneyField
        name="itemCost"
        label="Cost to us"
        value={value}
        onChange={onChange}
        error={error}
        hint={profit !== null ? `Profit on this sale: Rs ${profit.toLocaleString("en-PK")}` : "What you paid for the item. Used for profit."}
      />
      <div className="flex items-start gap-2.5 sm:pt-7">
        {alreadyPaid ? (
          <>
            <Checkbox id="itemCostPaidFromCash" checked disabled className="mt-0.5" />
            <Label htmlFor="itemCostPaidFromCash" className="flex-col items-start gap-0.5 font-normal">
              Paid from business cash
              <span className="text-xs text-muted-foreground">
                Rs {alreadyPaid.toLocaleString("en-PK")} is in the cash book. To change it, void that entry in the cash book, then tick this again.
              </span>
            </Label>
          </>
        ) : (
          <>
            <Checkbox
              id="itemCostPaidFromCash"
              name="itemCostPaidFromCash"
              checked={paid}
              onCheckedChange={(v) => onPaidChange(v === true)}
              className="mt-0.5"
            />
            <Label htmlFor="itemCostPaidFromCash" className="flex-col items-start gap-0.5 font-normal">
              Paid from business cash
              <span className="text-xs text-muted-foreground">
                Records the cost as money out in the cash book, on the agreement date. Don&apos;t also add it as an expense.
              </span>
            </Label>
          </>
        )}
      </div>
    </div>
  );
}

/** Money input with a "Rs" prefix and thousands separators. Controlled or uncontrolled. */
export function MoneyField({ name, label, error, hint, value, onChange, defaultValue, required, id }) {
  const inputId = id ?? name;
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={inputId}>
        {label}
        {required && <span className="text-destructive">*</span>}
      </FieldLabel>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-muted-foreground">Rs</span>
        <Input
          id={inputId}
          name={name}
          inputMode="numeric"
          autoComplete="off"
          className="pl-9 tabular-nums"
          aria-invalid={error ? true : undefined}
          {...(onChange
            ? { value, onChange: (e) => onChange(formatMoneyInput(e.target.value)) }
            : { defaultValue: formatMoneyInput(defaultValue), onChange: (e) => (e.target.value = formatMoneyInput(e.target.value)) })}
        />
      </div>
      {hint && !error && <p className="text-sm text-muted-foreground">{hint}</p>}
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}

export function SelectField({ name, label, value, defaultValue, onValueChange, options, error, id }) {
  const inputId = id ?? name;
  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      <Select name={name} value={value} defaultValue={defaultValue} onValueChange={onValueChange}>
        <SelectTrigger id={inputId} className="w-full" aria-invalid={error ? true : undefined}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <FieldError>{error}</FieldError>}
    </Field>
  );
}

export const ITEM_KIND_OPTIONS = Object.entries(ITEM_KIND_LABELS).map(([value, label]) => ({ value, label }));

/** Item kind, description, model and serial. */
export function ItemFields({ values = {}, errors = {} }) {
  return (
    <div className="grid gap-5 sm:grid-cols-2">
      <SelectField name="itemKind" label="Type of item" defaultValue={values.itemKind ?? "bike"} options={ITEM_KIND_OPTIONS} error={errors.itemKind} />
      <TextField name="itemDescription" label="Item" required placeholder="e.g. Honda CD70, black, new" defaultValue={values.itemDescription ?? ""} error={errors.itemDescription} />
      <TextField name="itemModel" label="Model / year" placeholder="e.g. 2026" defaultValue={values.itemModel ?? ""} error={errors.itemModel} />
      <TextField
        name="itemSerial"
        label="Registration / serial no."
        placeholder="e.g. BJJ-4802 or engine no."
        defaultValue={values.itemSerial ?? ""}
        error={errors.itemSerial}
        inputClassName="font-mono"
      />
    </div>
  );
}

let nextKey = 1;
const blankGuarantor = () => ({ key: nextKey++, name: "", fatherName: "", cnic: "", phone: "", profession: "", address: "" });

/** Zero or more guarantors (D-006: optional, any number). */
export function GuarantorFields({ initial = [], errors = {} }) {
  const [rows, setRows] = useState(() => initial.map((g) => ({ ...blankGuarantor(), ...g })));
  const remove = (key) => setRows((r) => r.filter((g) => g.key !== key));

  return (
    <div className="space-y-4">
      {rows.length === 0 && (
        <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">
          No guarantor. Guarantors are optional; add one if the agreement has one.
        </p>
      )}
      {rows.map((g, i) => {
        const err = (f) => errors[`guarantors.${i}.${f}`];
        const n = (f) => `guarantors.${i}.${f}`;
        return (
          <div key={g.key} className="rounded-xl border p-4 animate-in fade-in-0 slide-in-from-top-1 duration-200">
            <div className="mb-4 flex items-center justify-between">
              <p className="flex items-center gap-2 text-sm font-medium">
                <UserRoundCheckIcon className="size-4 text-muted-foreground" /> Guarantor {i + 1}
              </p>
              <Button type="button" variant="ghost" size="sm" onClick={() => remove(g.key)} className="text-muted-foreground hover:text-destructive">
                <Trash2Icon /> Remove
              </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <TextField id={`g${g.key}-name`} name={n("name")} label="Name" required defaultValue={g.name} error={err("name")} />
              <TextField id={`g${g.key}-father`} name={n("fatherName")} label="Father's name" defaultValue={g.fatherName} error={err("fatherName")} />
              <TextField
                id={`g${g.key}-cnic`}
                name={n("cnic")}
                label="CNIC"
                inputMode="numeric"
                placeholder={g.cnicMasked ? `Saved: ${g.cnicMasked}` : "31303-1234567-1"}
                defaultValue={g.cnic}
                error={err("cnic")}
                inputClassName="font-mono"
                onChange={(e) => (e.target.value = formatCnicInput(e.target.value))}
              />
              <TextField
                id={`g${g.key}-phone`}
                name={n("phone")}
                label="Phone"
                inputMode="tel"
                placeholder="0300-1234567"
                defaultValue={g.phone}
                error={err("phone")}
                inputClassName="font-mono"
                onChange={(e) => (e.target.value = formatPhoneInput(e.target.value))}
              />
              <TextField id={`g${g.key}-prof`} name={n("profession")} label="Profession" defaultValue={g.profession} error={err("profession")} />
              <TextField id={`g${g.key}-addr`} name={n("address")} label="Address" defaultValue={g.address} error={err("address")} />
            </div>
          </div>
        );
      })}
      <Button type="button" variant="outline" size="sm" onClick={() => setRows((r) => [...r, blankGuarantor()])}>
        <PlusIcon /> Add guarantor
      </Button>
    </div>
  );
}

export { TextareaField };
