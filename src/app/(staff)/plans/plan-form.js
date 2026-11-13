"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { BikeIcon, CalendarClockIcon, FilePlus2Icon, HashIcon, PackageIcon, UserRoundCheckIcon, UserIcon, WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FormAlert } from "@/components/app/form-alert";
import { TextField } from "@/components/app/form-fields";
import { SubmitButton } from "@/components/submit-button";
import { FREQUENCY_LABELS, buildRows, suggestFirstDueDate } from "@/lib/installment-schedule";
import { dateOnlyString, formatBusinessDate, parseDateOnly, todayPk } from "@/lib/business-date";
import { formatPKR } from "@/lib/format";
import { CustomerPicker } from "./customer-picker";
import { GuarantorFields, ItemCostFields, ItemFields, MoneyField, SelectField, TextareaField, formatMoneyInput, moneyValue } from "./plan-fields";

function Section({ icon: Icon, title, description, children }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

const FREQ_OPTIONS = Object.entries(FREQUENCY_LABELS).map(([value, label]) => ({ value, label }));

export function PlanForm({ action, initialCustomer, nextNumbers, bike }) {
  const [state, formAction] = useActionState(action, null);
  // Remount after a failed submit so every field shows what was sent back.
  const key = state?.values ? JSON.stringify(state.values) : "initial";
  return (
    <PlanFormInner
      key={key}
      formAction={formAction}
      state={state}
      values={state?.values ?? (bike ? { itemKind: "bike", itemDescription: bike.description, itemModel: bike.modelYear ? String(bike.modelYear) : "", itemSerial: bike.serial } : {})}
      bike={bike}
      initialCustomer={initialCustomer}
      nextNumbers={nextNumbers}
    />
  );
}

function PlanFormInner({ formAction, state, values, initialCustomer, nextNumbers, bike }) {
  const errors = state?.fieldErrors ?? {};
  const s0 = values.schedule ?? {};

  const [agreementDate, setAgreementDate] = useState(values.agreementDate ?? todayPk());
  const [cashPrice, setCashPrice] = useState(formatMoneyInput(values.cashPrice));
  const [agreedTotal, setAgreedTotal] = useState(formatMoneyInput(values.agreedTotal));
  const [advance, setAdvance] = useState(formatMoneyInput(values.advanceAmount));
  const [itemCost, setItemCost] = useState(formatMoneyInput(values.itemCost));
  const [costPaid, setCostPaid] = useState(values.itemCostPaidFromCash === "on");
  const [frequency, setFrequency] = useState(s0.frequency ?? "monthly");
  const [dueDay, setDueDay] = useState(s0.dueDayOfMonth ?? "10");
  const [intervalDays, setIntervalDays] = useState(s0.intervalDays ?? "15");
  const [installment, setInstallment] = useState(formatMoneyInput(s0.installmentAmount));
  const [firstDue, setFirstDue] = useState(s0.firstDueDate ?? "");
  const [firstDueTouched, setFirstDueTouched] = useState(Boolean(s0.firstDueDate));

  // Until staff pick a first due date themselves, keep suggesting one.
  const suggestedFirstDue = useMemo(() => {
    const d = parseDateOnly(agreementDate);
    if (!d) return "";
    return dateOnlyString(suggestFirstDueDate(d, { frequency, dueDayOfMonth: Number(dueDay) || undefined, intervalDays: Number(intervalDays) || undefined }));
  }, [agreementDate, frequency, dueDay, intervalDays]);
  const firstDueValue = firstDueTouched ? firstDue : suggestedFirstDue;

  const total = moneyValue(agreedTotal);
  const adv = moneyValue(advance);
  const cash = moneyValue(cashPrice);
  const inst = moneyValue(installment);
  const preview = useMemo(() => {
    const first = parseDateOnly(firstDueValue);
    const date = parseDateOnly(agreementDate);
    if (!total || !date || adv > total) return null;
    const rows = buildRows({
      agreedTotal: total,
      advanceAmount: adv,
      agreementDate: date,
      schedule: first && inst ? { frequency, dueDayOfMonth: Number(dueDay) || undefined, intervalDays: Number(intervalDays) || undefined, installmentAmount: inst, firstDueDate: first } : null,
    }).filter((r) => r.n > 0);
    return { remaining: total - adv, count: rows.length, last: rows.at(-1) ?? null };
  }, [total, adv, inst, frequency, dueDay, intervalDays, firstDueValue, agreementDate]);

  const guarantorsInitial = (values.guarantors ?? []).map((g) => ({ ...g }));

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <FormAlert>{state && !state.ok ? state.error : null}</FormAlert>

      <Section icon={UserIcon} title="Customer">
        <Field data-invalid={errors.customerId ? true : undefined}>
          <FieldLabel htmlFor="customerId">
            Customer <span className="text-destructive">*</span>
          </FieldLabel>
          <CustomerPicker initial={initialCustomer} invalid={Boolean(errors.customerId)} />
          {errors.customerId && <FieldError>{errors.customerId}</FieldError>}
          <p className="text-sm text-muted-foreground">
            Not registered yet?{" "}
            <Link href="/customers/new" className="font-medium text-foreground underline underline-offset-4">
              Add the customer first
            </Link>
            .
          </p>
        </Field>
      </Section>

      <Section icon={HashIcon} title="Agreement" description="Numbers continue from the paper records. Leave the account number empty to use the next one.">
        <div className="grid gap-5 sm:grid-cols-3">
          <TextField
            name="accountNumber"
            label="Account no."
            inputMode="numeric"
            placeholder={`Next: ${nextNumbers.accountNumber}`}
            defaultValue={values.accountNumber ?? ""}
            error={errors.accountNumber}
            hint={`Empty = ${nextNumbers.accountNumber}`}
            inputClassName="font-mono"
          />
          <TextField
            name="previousAccountNumber"
            label="Previous account no."
            inputMode="numeric"
            defaultValue={values.previousAccountNumber ?? ""}
            error={errors.previousAccountNumber}
            hint="If they had an earlier account."
            inputClassName="font-mono"
          />
          <TextField
            name="agreementDate"
            type="date"
            label="Agreement date"
            required
            value={agreementDate}
            max={todayPk()}
            onChange={(e) => setAgreementDate(e.target.value)}
            error={errors.agreementDate}
          />
        </div>
      </Section>

      <Section icon={PackageIcon} title="Item" description={bike ? "Filled in from the bike register. The bike is marked sold when the plan is created." : undefined}>
        {bike && (
          <div className="mb-5 flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
            <input type="hidden" name="relatedBikeId" value={bike.id} />
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BikeIcon className="size-4 text-brand" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium">
                <span className="font-mono">B-{bike.bikeNumber}</span> · {bike.label}
              </p>
              <p className="text-xs text-muted-foreground">Selling this bike on installments</p>
            </div>
          </div>
        )}
        {errors.relatedBikeId && <p className="mb-4 text-sm text-destructive">{errors.relatedBikeId}</p>}
        <ItemFields values={values} errors={errors} />
      </Section>

      <Section icon={WalletIcon} title="Price and advance" description="The total price is fixed when the agreement is made. There is no interest.">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <MoneyField name="cashPrice" label="Cash price" value={cashPrice} onChange={setCashPrice} error={errors.cashPrice} hint="Optional." />
          <MoneyField
            name="agreedTotal"
            label="Total price"
            required
            value={agreedTotal}
            onChange={setAgreedTotal}
            error={errors.agreedTotal}
            hint={cash && total >= cash ? `Markup ${formatPKR(total - cash)}` : "Cash price + markup."}
          />
          <MoneyField name="advanceAmount" label="Advance received" value={advance} onChange={setAdvance} error={errors.advanceAmount} hint="0 if none." />
          <TextField
            name="advanceReceiptNumber"
            label="Advance receipt no."
            inputMode="numeric"
            placeholder={`Next: ${nextNumbers.receiptNumber}`}
            defaultValue={values.advanceReceiptNumber ?? ""}
            error={errors.advanceReceiptNumber}
            hint="Optional."
            inputClassName="font-mono"
          />
        </div>
        {bike ? (
          <p className="mt-5 text-sm text-muted-foreground">
            Profit uses this bike&apos;s purchase price from the register as its cost.
            {bike.purchasePrice ? ` Cost ${formatPKR(bike.purchasePrice)}${total ? `, profit ${formatPKR(total - bike.purchasePrice)}` : ""}.` : ""}
          </p>
        ) : (
          <ItemCostFields
            total={total}
            value={itemCost}
            onChange={setItemCost}
            paid={costPaid}
            onPaidChange={setCostPaid}
            error={errors.itemCost}
          />
        )}
      </Section>

      <Section icon={CalendarClockIcon} title="Payment schedule" description="Payments of any amount are accepted on any date; this sets what is expected and when.">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <SelectField id="frequency" name="schedule.frequency" label="How often" value={frequency} onValueChange={setFrequency} options={FREQ_OPTIONS} error={errors["schedule.frequency"]} />
          {frequency === "monthly" && (
            <TextField
              name="schedule.dueDayOfMonth"
              label="Due by day of month"
              type="number"
              min={1}
              max={31}
              value={dueDay}
              onChange={(e) => setDueDay(e.target.value)}
              error={errors["schedule.dueDayOfMonth"]}
              hint="e.g. 10 = by the 10th."
            />
          )}
          {frequency === "custom" && (
            <TextField
              name="schedule.intervalDays"
              label="Every how many days"
              type="number"
              min={1}
              max={365}
              value={intervalDays}
              onChange={(e) => setIntervalDays(e.target.value)}
              error={errors["schedule.intervalDays"]}
            />
          )}
          <MoneyField
            id="installmentAmount"
            name="schedule.installmentAmount"
            label="Installment amount"
            required={adv < total}
            value={installment}
            onChange={setInstallment}
            error={errors["schedule.installmentAmount"]}
          />
          <TextField
            name="schedule.firstDueDate"
            type="date"
            label="First installment due"
            value={firstDueValue}
            onChange={(e) => {
              setFirstDueTouched(true);
              setFirstDue(e.target.value);
            }}
            error={errors["schedule.firstDueDate"]}
          />
        </div>

        <div className="mt-5 grid gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
          {[
            { label: "Balance after advance", value: preview ? formatPKR(preview.remaining) : "—" },
            { label: "Installments", value: preview?.count ? `${preview.count} × ${formatPKR(inst)}${preview.last && preview.last.amount !== inst ? ` (last ${formatPKR(preview.last.amount)})` : ""}` : "—" },
            { label: "Last due date", value: preview?.last ? formatBusinessDate(preview.last.dueDate) : "—" },
          ].map((x) => (
            <div key={x.label} className="bg-muted/40 px-4 py-3">
              <p className="text-xs text-muted-foreground">{x.label}</p>
              <p className="mt-0.5 font-medium tabular-nums">{x.value}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={UserRoundCheckIcon} title="Guarantors" description="Optional.">
        <GuarantorFields initial={guarantorsInitial} errors={errors} />
      </Section>

      <Card>
        <CardContent>
          <TextareaField name="notes" label="Notes" rows={3} defaultValue={values.notes ?? ""} error={errors.notes} hint="Anything from the agreement's note line." />
        </CardContent>
      </Card>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-end sm:rounded-xl sm:border">
        {preview && (
          <p className="mr-auto hidden text-sm text-muted-foreground sm:block">
            Total <span className="font-medium text-foreground tabular-nums">{formatPKR(total)}</span> · advance{" "}
            <span className="font-medium text-foreground tabular-nums">{formatPKR(adv)}</span>
          </p>
        )}
        <Button variant="outline" asChild>
          <Link href="/plans">Cancel</Link>
        </Button>
        <SubmitButton icon={FilePlus2Icon}>Create plan</SubmitButton>
      </div>
    </form>
  );
}
