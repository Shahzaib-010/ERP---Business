"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { KeyRoundIcon, PowerOffIcon } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { FormAlert } from "@/components/app/form-alert";
import { TextField } from "@/components/app/form-fields";
import { SubmitButton } from "@/components/submit-button";

export function PortalAccess({ enabled, customerName, setPasswordAction, disableAction }) {
  const [pwState, pwAction] = useActionState(setPasswordAction, null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disabling, startDisable] = useTransition();
  const formRef = useRef(null);
  const errors = pwState?.fieldErrors ?? {};

  useEffect(() => {
    if (pwState?.ok) {
      toast.success("Portal password set", { description: `${customerName} can now sign in with their CNIC.` });
      formRef.current?.reset();
    }
  }, [pwState, customerName]);

  const disable = () =>
    startDisable(async () => {
      const res = await disableAction(null);
      setConfirmOpen(false);
      if (res?.ok) toast.success("Portal login turned off", { description: `${customerName} has been signed out.` });
      else toast.error(res?.error ?? "Could not turn off the portal login.");
    });

  return (
    <div className="space-y-6">
      <form ref={formRef} action={pwAction} className="space-y-4" noValidate>
        <FormAlert>{pwState && !pwState.ok ? pwState.error : null}</FormAlert>
        <TextField
          name="password"
          type="password"
          autoComplete="new-password"
          label={enabled ? "New password" : "Password"}
          hint="At least 8 characters. Give it to the customer privately."
          error={errors.password}
          className="max-w-sm"
        />
        <SubmitButton icon={KeyRoundIcon} variant={enabled ? "outline" : "default"}>
          {enabled ? "Reset password" : "Turn on portal login"}
        </SubmitButton>
      </form>

      {enabled && (
        <>
          <Separator />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium">Turn off portal login</p>
              <p className="text-sm text-muted-foreground">The customer is signed out at once and cannot sign in again.</p>
            </div>
            <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive">
                  <PowerOffIcon /> Turn off
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Turn off portal login?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {customerName} will be signed out of the customer portal immediately. You can turn it on again later by
                    setting a new password.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel disabled={disabling}>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant="destructive"
                    disabled={disabling}
                    onClick={(e) => {
                      e.preventDefault();
                      disable();
                    }}
                  >
                    {disabling ? "Turning off…" : "Turn off"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </>
      )}
    </div>
  );
}
