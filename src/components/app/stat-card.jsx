import Link from "next/link";
import { ArrowDownRightIcon, ArrowUpRightIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/** One headline figure. `trend` = { value: "+3", up: true, label: "vs last month" }. */
export function StatCard({ label, value, icon: Icon, hint, trend, href, tone = "primary" }) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    success: "bg-success/10 text-success",
    warning: "bg-warning/15 text-warning",
    muted: "bg-muted text-muted-foreground",
  };
  const body = (
    <Card className={cn("h-full gap-3 transition-shadow", href && "hover:shadow-md hover:ring-1 hover:ring-primary/20")}>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardDescription className="font-medium">{label}</CardDescription>
        {Icon && (
          <div className={cn("flex size-8 items-center justify-center rounded-lg", tones[tone])}>
            <Icon className="size-4" />
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-1">
        <CardTitle className="text-3xl font-semibold tabular-nums tracking-tight">{value}</CardTitle>
        {(trend || hint) && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            {trend && (
              <span className={cn("inline-flex items-center font-medium", trend.up ? "text-success" : "text-destructive")}>
                {trend.up ? <ArrowUpRightIcon className="size-3.5" /> : <ArrowDownRightIcon className="size-3.5" />}
                {trend.value}
              </span>
            )}
            <span>{trend?.label ?? hint}</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      {body}
    </Link>
  ) : (
    body
  );
}
