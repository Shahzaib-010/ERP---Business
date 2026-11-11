"use client";

import { useActionState, useEffect, useRef } from "react";
import { KeyRoundIcon } from "lucide-react";
import { toast } from "sonner";
import { FormAlert } from "@/components/app/form-alert";
import { TextField } from "@/components/app/form-fields";
import { SubmitButton } from "@/components/submit-button";
import { changeOwnPasswordAction } from "./actions";

export function ChangePasswordForm() {
  const [state, formAction] = useActionState(changeOwnPasswordAction, null);
  const formRef = useRef(null);
  const errors = state?.fieldErrors ?? {};

  useEffect(() => {
    if (state?.ok) {
      toast.success("Password changed", { description: "Other devices have been signed out." });
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form ref={formRef} action={formAction} className="flex max-w-sm flex-col gap-4" noValidate>
      <FormAlert>{state && !state.ok ? state.error : null}</FormAlert>
      <TextField name="currentPassword" type="password" label="Current password" autoComplete="current-password" error={errors.currentPassword} />
      <TextField name="newPassword" type="password" label="New password" autoComplete="new-password" hint="At least 8 characters." error={errors.newPassword} />
      <TextField name="confirmPassword" type="password" label="Repeat new password" autoComplete="new-password" error={errors.confirmPassword} />
      <div>
        <SubmitButton icon={KeyRoundIcon}>Change password</SubmitButton>
      </div>
    </form>
  );
}
