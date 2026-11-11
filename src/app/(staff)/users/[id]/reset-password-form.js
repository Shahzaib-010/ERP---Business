"use client";

import { useActionState } from "react";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function ResetPasswordForm({ action }) {
  const [state, formAction] = useActionState(action, null);
  const errors = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Alert>{state && !state.ok ? state.error : null}</Alert>
      <Alert tone="success">{state?.ok ? "Password reset." : null}</Alert>
      <Field label="New password" name="password" error={errors.password} hint="At least 8 characters.">
        <Input name="password" type="password" autoComplete="new-password" error={errors.password} />
      </Field>
      <SubmitButton variant="secondary">Reset password</SubmitButton>
    </form>
  );
}
