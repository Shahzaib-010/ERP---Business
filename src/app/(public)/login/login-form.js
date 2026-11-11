"use client";

import { useActionState, useState } from "react";
import { EyeIcon, EyeOffIcon, IdCardIcon, LockIcon, LogInIcon, UserIcon } from "lucide-react";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from "@/components/ui/input-group";
import { FormAlert } from "@/components/app/form-alert";
import { formatCnicInput } from "@/components/app/form-fields";
import { SubmitButton } from "@/components/submit-button";
import { customerLoginAction, staffLoginAction } from "@/app/auth-actions";

const CONFIG = {
  staff: {
    action: staffLoginAction,
    idName: "username",
    idLabel: "Username",
    icon: UserIcon,
    idProps: { autoComplete: "username", autoCapitalize: "none", spellCheck: false, placeholder: "your.username" },
  },
  customer: {
    action: customerLoginAction,
    idName: "cnic",
    idLabel: "CNIC number",
    icon: IdCardIcon,
    idProps: { autoComplete: "username", inputMode: "numeric", placeholder: "31303-1234567-1", className: "font-mono" },
    format: formatCnicInput,
  },
};

export function LoginForm({ kind }) {
  const cfg = CONFIG[kind];
  const [state, formAction] = useActionState(cfg.action, null);
  const [showPassword, setShowPassword] = useState(false);
  const errors = state?.fieldErrors ?? {};
  const IdIcon = cfg.icon;

  return (
    <form action={formAction} className="flex flex-col gap-5" noValidate>
      <FormAlert>{state?.error}</FormAlert>

      <Field data-invalid={errors[cfg.idName] ? true : undefined}>
        <FieldLabel htmlFor={cfg.idName}>{cfg.idLabel}</FieldLabel>
        <InputGroup className="h-10">
          <InputGroupAddon>
            <IdIcon />
          </InputGroupAddon>
          <InputGroupInput
            id={cfg.idName}
            name={cfg.idName}
            required
            autoFocus
            defaultValue={state?.values?.[cfg.idName] ?? ""}
            aria-invalid={errors[cfg.idName] ? true : undefined}
            onChange={cfg.format ? (e) => (e.target.value = cfg.format(e.target.value)) : undefined}
            {...cfg.idProps}
          />
        </InputGroup>
        {errors[cfg.idName] && <FieldError>{errors[cfg.idName]}</FieldError>}
      </Field>

      <Field data-invalid={errors.password ? true : undefined}>
        <FieldLabel htmlFor="password">Password</FieldLabel>
        <InputGroup className="h-10">
          <InputGroupAddon>
            <LockIcon />
          </InputGroupAddon>
          <InputGroupInput
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            aria-invalid={errors.password ? true : undefined}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              size="icon-xs"
              onClick={() => setShowPassword((s) => !s)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
        {errors.password && <FieldError>{errors.password}</FieldError>}
      </Field>

      <SubmitButton pendingLabel="Signing in…" size="lg" className="h-10 w-full" icon={LogInIcon}>
        Sign in
      </SubmitButton>
    </form>
  );
}
