"use client";

import { useActionState } from "react";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function PortalAccess({ enabled, setPasswordAction, disableAction }) {
  const [pwState, pwAction] = useActionState(setPasswordAction, null);
  const [offState, offAction] = useActionState(disableAction, null);
  const errors = pwState?.fieldErrors ?? {};

  return (
    <div className="space-y-4">
      <form action={pwAction} className="space-y-3" noValidate>
        <Alert>{pwState && !pwState.ok ? pwState.error : null}</Alert>
        <Alert tone="success">{pwState?.ok ? "Password set. Portal login is on." : null}</Alert>
        <Field
          label={enabled ? "New password" : "Password"}
          name="password"
          error={errors.password}
          hint="At least 8 characters. Give it to the customer privately."
        >
          <Input name="password" type="password" autoComplete="new-password" error={errors.password} />
        </Field>
        <SubmitButton variant="secondary">
          {enabled ? "Reset password" : "Turn on portal login"}
        </SubmitButton>
      </form>

      {enabled && (
        <form action={offAction} className="space-y-2 border-t border-slate-100 pt-4">
          <Alert>{offState && !offState.ok ? offState.error : null}</Alert>
          <p className="text-sm text-slate-600">Turning it off signs the customer out at once.</p>
          <SubmitButton variant="danger" pendingLabel="Turning off…">
            Turn off portal login
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
