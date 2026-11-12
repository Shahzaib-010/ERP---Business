"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

/** Submit button that disables itself and shows a spinner while its form is submitting. */
export function SubmitButton({ children, pendingLabel = "Saving…", variant = "default", size = "default", className, icon: Icon, disabled = false }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || disabled} variant={variant} size={size} className={className}>
      {pending ? <Spinner /> : Icon ? <Icon /> : null}
      {pending ? pendingLabel : children}
    </Button>
  );
}
