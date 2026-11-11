"use client";

import { useActionState, useEffect, useRef } from "react";
import { KeyRoundIcon } from "lucide-react";
import { toast } from "sonner";
import { FormAlert } from "@/components/app/form-alert";
import { TextField } from "@/components/app/form-fields";
import { SubmitButton } from "@/components/submit-button";

export function ResetPasswordForm({ action }) {
  const [state, formAction] = useActionState(action, null);
  const formRef = useRef(null);
  const errors = state?.fieldErrors ?? {};

  useEffect(() => {
    if (state?.ok) {
      toast.success("Password reset", { description: "They have been signed out everywhere." });
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex max-w-sm flex-col gap-4" noValidate>
      <FormAlert>{state && !state.ok ? state.error : null}</FormAlert>
      <TextField
        name="password"
        type="password"
        label="New password"
        autoComplete="new-password"
        hint="At least 8 characters."
        error={errors.password}
      />
      <div>
        <SubmitButton variant="outline" icon={KeyRoundIcon}>
          Reset password
        </SubmitButton>
      </div>
    </form>
  );
}
