import { AlarmClockIcon, CheckCircle2Icon, CircleDotIcon, XCircleIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const ITEM_KIND_LABELS = { bike: "Motorcycle", mobile: "Mobile phone", appliance: "Appliance", other: "Other" };
export const PAYMENT_KIND_LABELS = { advance: "Advance", installment: "Installment", discount: "Discount" };

/** Active / Late N days / Completed / Cancelled. */
export function PlanStatusBadge({ status, overdue, className }) {
  if (status === "completed")
    return (
      <Badge className={cn("gap-1 bg-success/12 text-success hover:bg-success/12", className)}>
        <CheckCircle2Icon /> Completed
      </Badge>
    );
  if (status === "cancelled")
    return (
      <Badge variant="secondary" className={cn("gap-1", className)}>
        <XCircleIcon /> Cancelled
      </Badge>
    );
  if (overdue)
    return (
      <Badge className={cn("gap-1 bg-destructive/12 text-destructive hover:bg-destructive/12", className)}>
        <AlarmClockIcon /> Late {overdue.daysLate} {overdue.daysLate === 1 ? "day" : "days"}
      </Badge>
    );
  return (
    <Badge variant="outline" className={cn("gap-1", className)}>
      <CircleDotIcon className="text-success" /> Active
    </Badge>
  );
}

/** Thin progress bar. Red when late, green when complete. */
export function PlanProgress({ percent, status, overdue, className }) {
  const tone = status === "completed" ? "bg-success" : overdue ? "bg-destructive" : "bg-primary";
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)} role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
      <div className={cn("h-full rounded-full transition-[width] duration-500", tone)} style={{ width: `${percent}%` }} />
    </div>
  );
}
