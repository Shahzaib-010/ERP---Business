import Link from "next/link";
import { ArrowDownRightIcon, ArrowUpRightIcon, MinusIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Sparkline } from "@/components/app/charts/finance-charts";
import { CountUp } from "@/components/app/count-up";
import { cn } from "@/lib/utils";

/** Change vs the previous period: { text, dir }. */
export function delta(value, previous) {
  if (previous === undefined || previous === null) return null;
  if (previous === 0 && value === 0) return { text: "No change", dir: 0 };
  if (previous === 0) return { text: "New", dir: value > 0 ? 1 : -1 };
  const pct = Math.round(((value - previous) / Math.abs(previous)) * 100);
  return { text: `${pct > 0 ? "+" : ""}${pct}%`, dir: Math.sign(pct) };
}

/** Small "+12%" chip. goodWhen: "up", "down" or null (neutral). */
export function DeltaChip({ value, previous, goodWhen = "up", className }) {
  const d = delta(value, previous);
  if (!d) return null;
  const good = goodWhen ? (goodWhen === "up" ? d.dir > 0 : d.dir < 0) : null;
  const Icon = d.dir === 0 ? MinusIcon : d.dir > 0 ? ArrowUpRightIcon : ArrowDownRightIcon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
        d.dir === 0 || good === null ? "bg-muted text-foreground" : good ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive",
        className,
      )}
    >
      <Icon className="size-3" aria-hidden="true" />
      {d.text}
    </span>
  );
}

/**
 * Compact KPI with a 12-month sparkline underneath.
 * trend = [{ label, [trendKey]: n }], money = show "Rs".
 */
export function SparkKpi({ label, value, previous, compareLabel, trend, trendKey, money = true, goodWhen = "up", icon: Icon, href, hint, color }) {
  const body = (
    <Card className={cn("h-full gap-3 px-5 py-4 transition-shadow", href && "hover:shadow-md")}>
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          {Icon && <Icon className="size-4" />}
          {label}
        </p>
        <DeltaChip value={value} previous={previous} goodWhen={goodWhen} />
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          <CountUp value={value} prefix={money ? "Rs " : ""} />
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint ?? compareLabel}</p>
      </div>
      {trend && <Sparkline data={trend} dataKey={trendKey} money={money} color={color} />}
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

/** Label + value pair used inside larger panels. */
export function Figure({ label, value, money = true, previous, goodWhen = "up", sub, className, big }) {
  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap items-center gap-2">
        <span className={cn("font-semibold tracking-tight tabular-nums", big ? "text-2xl" : "text-lg", value < 0 && "text-destructive")}>
          <CountUp value={value} prefix={money ? "Rs " : ""} />
        </span>
        {previous !== undefined && <DeltaChip value={value} previous={previous} goodWhen={goodWhen} />}
      </div>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
