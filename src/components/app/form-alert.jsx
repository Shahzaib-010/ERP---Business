import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/** Error (default) or success message at the top of a form. Renders nothing without a message. */
export function FormAlert({ tone = "error", children }) {
  if (!children) return null;
  const Icon = tone === "error" ? CircleAlertIcon : CircleCheckIcon;
  return (
    <Alert
      variant={tone === "error" ? "destructive" : "default"}
      className={tone === "success" ? "border-success/30 bg-success/5 text-success [&>svg]:text-success" : undefined}
    >
      <Icon />
      <AlertDescription className={tone === "success" ? "text-success" : undefined}>{children}</AlertDescription>
    </Alert>
  );
}
