"use client";

import { useFormStatus } from "react-dom";
import { buttonClass } from "./ui";

export function SubmitButton({ children, pendingLabel = "Saving…", variant = "primary", className = "" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, className)}>
      {pending ? pendingLabel : children}
    </button>
  );
}
