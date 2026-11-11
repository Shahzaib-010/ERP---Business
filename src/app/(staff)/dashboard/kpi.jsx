import Link from "next/link";
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CountUp } from "@/components/app/count-up";
import { cn } from "@/lib/utils";

/**
 * Headline figure with an optional change versus the previous period.
 * goodWhen: "up" (more is good), "down" (less is good) or null (neutral, e.g. cash out).
 */
export function Kpi({ label, value, previous, money = true, icon: Icon, tone = "primary", goodWhen = "up", hint, href, compareLabel, accent }) {
  const tones = {
    primary: "bg-primary/8 text-primary",
    success: "bg-success/12 text-success",
    warning: "bg-warning/15 text-warning-foreground dark:text-warning",
    danger: "bg-destructive/10 text-destructive",
    muted: "bg-muted text-muted-foreground",
  };
  let delta = null;
  if (previous !== undefined) {
    if (previous === 0 && value === 0) delta = { text: "No change", dir: 0 };
    else if (previous === 0) delta = { text: "New", dir: value > 0 ? 1 : -1 };
    else {
      const pct = Math.round(((value - previous) / Math.abs(previous)) * 100);
      delta = { text: `${pct > 0 ? "+" : ""}${pct}%`, dir: Math.sign(pct) };
    }
  }
  const good = delta && goodWhen ? (goodWhen === "up" ? delta.dir > 0 : delta.dir < 0) : null;
  const DeltaIcon = !delta || delta.dir === 0 ? MinusIcon : delta.dir > 0 ? ArrowUpRightIcon : ArrowDownRightIcon;

  const body = (
    <Card className={cn("relative h-full gap-2 overflow-hidden transition-shadow", href && "hover:shadow-md", accent && "border-primary/30")}>
      {accent && <div className="pointer-events-none absolute inset-x-0 top-0 h-0.5 bg-brand shadow-[0_0_10px_var(--brand)]" />}
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardDescription className="font-medium">{label}</CardDescription>
        {Icon && (
          <span className={cn("flex size-8 items-center justify-center rounded-lg", tones[tone])}>
            <Icon className="size-4" />
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-1.5">
        <CardTitle className={cn("text-2xl font-semibold tracking-tight tabular-nums sm:text-[1.7rem]", value < 0 && "text-destructive")}>
          <CountUp value={value} prefix={money ? "Rs " : ""} />
        </CardTitle>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          {delta && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium",
                good === true && "bg-success/10 text-success",
                good === false && "bg-destructive/10 text-destructive",
                good === null && "bg-muted text-foreground",
              )}
            >
              <DeltaIcon className="size-3" aria-hidden="true" />
              {delta.text}
            </span>
          )}
          <span>{delta ? compareLabel : hint}</span>
        </div>
        {delta && hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
  return href ? (
    <Link href={href} className="block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}
