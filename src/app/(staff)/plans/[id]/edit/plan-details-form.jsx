"use client";

import { useActionState } from "react";
import Link from "next/link";
import { HashIcon, PackageIcon, SaveIcon, UserRoundCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FormAlert } from "@/components/app/form-alert";
import { TextField, TextareaField } from "@/components/app/form-fields";
import { SubmitButton } from "@/components/submit-button";
import { GuarantorFields, ItemFields } from "../../plan-fields";

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

export function PlanDetailsForm({ action, initial, cancelHref }) {
  const [state, formAction] = useActionState(action, null);
  const values = state?.values ?? initial;
  const errors = state?.fieldErrors ?? {};
  const key = state?.values ? JSON.stringify(state.values) : "initial";
  const maskedNote = initial.guarantors.some((g) => g.cnicMasked);

  return (
    <form key={key} action={formAction} className="flex flex-col gap-6" noValidate>
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
