"use client";

import { useActionState } from "react";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { changeOwnPasswordAction } from "./actions";

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changeOwnPasswordAction, null);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Alert>{state && !state.ok ? state.error : null}</Alert>
      <Alert tone="success">
        {state?.ok ? "Password changed. Other devices have been signed out." : null}
      </Alert>
      <Field label="Current password" name="currentPassword" error={errors.currentPassword}>
        <Input name="currentPassword" type="password" autoComplete="current-password" error={errors.currentPassword} />
      </Field>
      <Field label="New password" name="newPassword" error={errors.newPassword} hint="At least 8 characters.">
        <Input name="newPassword" type="password" autoComplete="new-password" error={errors.newPassword} />
      </Field>
      <Field label="Repeat new password" name="confirmPassword" error={errors.confirmPassword}>
        <Input name="confirmPassword" type="password" autoComplete="new-password" error={errors.confirmPassword} />
      </Field>
      <SubmitButton>Change password</SubmitButton>
    </form>
  );
}
