import { CheckCircle2Icon, PackageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const bikeNo = (n) => `B-${n}`;

export function BikeStatusBadge({ status, className }) {
  if (status === "sold")
    return (
      <Badge variant="secondary" className={cn("gap-1", className)}>
        <CheckCircle2Icon /> Sold
      </Badge>
    );
  return (
    <Badge variant="outline" className={cn("gap-1.5", className)}>
      <span className="size-1.5 rounded-full bg-brand shadow-[0_0_6px_var(--brand)]" /> In stock
    </Badge>
  );
}

export function ConditionBadge({ condition, className }) {
  return (
    <Badge variant="outline" className={cn("capitalize", condition === "new" ? "border-primary/30 text-primary" : "text-muted-foreground", className)}>
      {condition}
    </Badge>
  );
}

export function OwedBadge({ amount, className }) {
  if (!amount) return null;
  return (
    <Badge className={cn("gap-1 bg-warning/15 text-foreground hover:bg-warning/15", className)}>
      <PackageIcon /> Owe seller Rs {amount.toLocaleString("en-PK")}
    </Badge>
  );
}
