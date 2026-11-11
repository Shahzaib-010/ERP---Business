"use client";

import { useActionState } from "react";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { customerLoginAction, staffLoginAction } from "@/app/auth-actions";

const CONFIG = {
  staff: {
    action: staffLoginAction,
    idName: "username",
    idLabel: "Username",
    idProps: { autoComplete: "username", autoCapitalize: "none", spellCheck: false },
  },
  customer: {
    action: customerLoginAction,
    idName: "cnic",
    idLabel: "CNIC number",
    idProps: { autoComplete: "username", inputMode: "numeric", placeholder: "31303-1234567-1" },
  },
};

export function LoginForm({ kind }) {
  const cfg = CONFIG[kind];
  const [state, formAction] = useActionState(cfg.action, null);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <Alert>{state?.error}</Alert>
      <Field label={cfg.idLabel} name={cfg.idName} error={errors[cfg.idName]}>
        <Input
          name={cfg.idName}
          required
          defaultValue={state?.values?.[cfg.idName] ?? ""}
          error={errors[cfg.idName]}
          {...cfg.idProps}
        />
      </Field>
      <Field label="Password" name="password" error={errors.password}>
        <Input
          name="password"
          type="password"
          required
          autoComplete="current-password"
          error={errors.password}
        />
      </Field>
      <SubmitButton pendingLabel="Signing in…" className="w-full">
        Sign in
      </SubmitButton>
    </form>
  );
}
