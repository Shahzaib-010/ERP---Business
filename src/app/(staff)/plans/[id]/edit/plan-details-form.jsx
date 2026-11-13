"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { HashIcon, PackageIcon, SaveIcon, UserRoundCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert } from "@/components/app/form-alert";
import { TextField, TextareaField } from "@/components/app/form-fields";
import { SubmitButton } from "@/components/submit-button";
import { formatPKR } from "@/lib/format";
import { GuarantorFields, ItemCostFields, ItemFields, formatMoneyInput } from "../../plan-fields";

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

export function PlanDetailsForm({ action, initial, cancelHref, cost }) {
  const [state, formAction] = useActionState(action, null);
  const values = state?.values ?? initial;
  const key = state?.values ? JSON.stringify(state.values) : "initial";
  // Remount after a failed submit so every field (including the controlled cost) shows what was sent.
  return <PlanDetailsFormInner key={key} formAction={formAction} state={state} values={values} initial={initial} cancelHref={cancelHref} cost={cost} />;
}

function PlanDetailsFormInner({ formAction, state, values, initial, cancelHref, cost }) {
  const errors = state?.fieldErrors ?? {};
  const maskedNote = initial.guarantors.some((g) => g.cnicMasked);
  const [itemCost, setItemCost] = useState(formatMoneyInput(values.itemCost));
  const [costPaid, setCostPaid] = useState(values.itemCostPaidFromCash === "on");

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <FormAlert>{state && !state.ok ? state.error : null}</FormAlert>
      <Section icon={HashIcon} title="Account">
        <div className="max-w-xs">
          <TextField
            name="previousAccountNumber"
            label="Previous account no."
            inputMode="numeric"
            defaultValue={values.previousAccountNumber ?? ""}
            error={errors.previousAccountNumber}
            inputClassName="font-mono"
          />
        </div>
      </Section>
      <Section icon={PackageIcon} title="Item">
        <ItemFields values={values} errors={errors} />
        {cost.fromBike ? (
          <p className="mt-5 border-t pt-5 text-sm text-muted-foreground">
            This plan sells a bike from the register, so profit uses the bike&apos;s purchase price
            {cost.bikeCost != null ? ` (${formatPKR(cost.bikeCost)})` : ""} as its cost.
          </p>
        ) : (
          <ItemCostFields
            total={cost.agreedTotal}
            value={itemCost}
            onChange={setItemCost}
            paid={costPaid}
            onPaidChange={setCostPaid}
            error={errors.itemCost}
            alreadyPaid={cost.paidAmount}
          />
        )}
      </Section>
      <Section
        icon={UserRoundCheckIcon}
        title="Guarantors"
        description={maskedNote ? "For privacy, saved CNICs are not shown. Leave the CNIC box empty to keep the saved one, or type a new one to replace it." : "Optional."}
      >
        <GuarantorFields initial={values.guarantors ?? []} errors={errors} />
      </Section>
      <Card>
        <CardContent>
          <TextareaField name="notes" label="Notes" rows={3} defaultValue={values.notes ?? ""} error={errors.notes} />
        </CardContent>
      </Card>
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t bg-background/90 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:justify-end sm:rounded-xl sm:border">
        <Button variant="outline" asChild>
          <Link href={cancelHref}>Cancel</Link>
        </Button>
        <SubmitButton icon={SaveIcon}>Save changes</SubmitButton>
      </div>
    </form>
  );
}
