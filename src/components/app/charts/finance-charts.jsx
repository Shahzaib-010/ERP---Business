"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { AlertOctagonIcon, AlertTriangleIcon, CheckCircle2Icon, ClockIcon } from "lucide-react";
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

// Charts for the dashboard. Colours come from CSS tokens (--viz-*, --status-*), validated
// for light and dark separately. Marks: columns <= 18px, 4px rounded data end, 2px gap
// between stacked segments, hairline grid, legend for 2+ series, tooltip on hover.

const pkr = (n) => `Rs ${Math.round(n).toLocaleString("en-PK")}`;
/** Axis ticks: 0, 50K, 1.2M. */
const compact = (n) => {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${(n / 1_000_000).toFixed(a >= 10_000_000 ? 0 : 1).replace(/\.0$/, "")}M`;
  if (a >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
};

const axisProps = {
  tickLine: false,
  axisLine: false,
  tick: { fill: "var(--muted-foreground)", fontSize: 11 },
};

function MoneyTooltip() {
  return (
    <ChartTooltip
      cursor={{ fill: "var(--muted)", opacity: 0.6 }}
      content={
        <ChartTooltipContent
          indicator="dot"
          formatter={(value, name, item) => (
            <div className="flex w-full items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <span className="size-2.5 rounded-[3px]" style={{ background: item.color }} />
                {item.payload && name}
              </span>
              <span className="font-medium tabular-nums text-foreground">{pkr(value)}</span>
            </div>
          )}
        />
      }
    />
  );
}

/** Cash in vs cash out per month (grouped columns, one axis). */
export function CashFlowChart({ data }) {
  const config = {
    cashIn: { label: "Cash in", color: "var(--viz-1)" },
    cashOut: { label: "Cash out", color: "var(--viz-2)" },
  };
  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <BarChart data={data} barGap={2} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
        <XAxis dataKey="label" {...axisProps} tickMargin={8} interval="preserveStartEnd" />
        <YAxis {...axisProps} width={44} tickFormatter={compact} />
        <MoneyTooltip />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="cashIn" name="Cash in" fill="var(--color-cashIn)" radius={[4, 4, 0, 0]} maxBarSize={18} />
        <Bar dataKey="cashOut" name="Cash out" fill="var(--color-cashOut)" radius={[4, 4, 0, 0]} maxBarSize={18} />
      </BarChart>
    </ChartContainer>
  );
}

/** Sales per month, split into cash and installment sales (stacked, 2px surface gap). */
export function SalesChart({ data }) {
  const config = {
    salesInstallment: { label: "On installments", color: "var(--viz-1)" },
    salesCash: { label: "Cash sales", color: "var(--viz-3)" },
  };
  return (
    <ChartContainer config={config} className="aspect-auto h-72 w-full">
      <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
        <XAxis dataKey="label" {...axisProps} tickMargin={8} interval="preserveStartEnd" />
        <YAxis {...axisProps} width={44} tickFormatter={compact} />
        <MoneyTooltip />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="salesInstallment" name="On installments" stackId="s" fill="var(--color-salesInstallment)" stroke="var(--card)" strokeWidth={1} maxBarSize={22} />
        <Bar dataKey="salesCash" name="Cash sales" stackId="s" fill="var(--color-salesCash)" stroke="var(--card)" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={22} />
      </BarChart>
    </ChartContainer>
  );
}

/** Ranked horizontal bars for one measure (single hue, value at the tip). */
export function BreakdownBars({ items, tone = "in", empty = "Nothing in this period." }) {
  const total = items.reduce((s, x) => s + x.value, 0);
  const max = Math.max(1, ...items.map((x) => x.value));
  const visible = items.filter((x) => x.value > 0);
  if (!visible.length) return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  const color = tone === "in" ? "var(--viz-1)" : "var(--viz-2)";
  return (
    <ul className="space-y-3.5">
      {visible.map((x) => {
        const pct = total ? Math.round((x.value / total) * 100) : 0;
        return (
          <li key={x.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-muted-foreground">{x.label}</span>
              <span className="shrink-0 font-medium tabular-nums">{pkr(x.value)}</span>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="h-2.5 w-full cursor-default rounded-full bg-muted" tabIndex={0} aria-label={`${x.label}: ${pkr(x.value)}, ${pct}%`}>
                  <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${(x.value / max) * 100}%`, background: color }} />
                </div>
              </TooltipTrigger>
              <TooltipContent>
                {x.label}: {pkr(x.value)} ({pct}% of total)
              </TooltipContent>
            </Tooltip>
          </li>
        );
      })}
    </ul>
  );
}

const AGING_STYLE = {
  on_time: { color: "var(--status-good)", icon: CheckCircle2Icon },
  d1_30: { color: "var(--status-warning)", icon: ClockIcon },
  d31_60: { color: "var(--status-serious)", icon: AlertTriangleIcon },
  d60p: { color: "var(--status-critical)", icon: AlertOctagonIcon },
};

/** Receivables by how late they are: one segmented bar + a labelled list (status = icon + label). */
export function AgingBreakdown({ buckets, total }) {
  if (!total) return <p className="py-10 text-center text-sm text-muted-foreground">No money is owed on active plans.</p>;
  return (
    <div className="space-y-5">
      <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full" role="img" aria-label="Receivables by lateness">
        {buckets
          .filter((b) => b.balance > 0)
          .map((b) => (
            <Tooltip key={b.key}>
              <TooltipTrigger asChild>
                <div className="h-full first:rounded-l-full last:rounded-r-full" style={{ width: `${(b.balance / total) * 100}%`, background: AGING_STYLE[b.key].color }} />
              </TooltipTrigger>
              <TooltipContent>
                {b.label}: {pkr(b.balance)} on {b.count} {b.count === 1 ? "plan" : "plans"}
              </TooltipContent>
            </Tooltip>
          ))}
      </div>
      <ul className="divide-y">
        {buckets.map((b) => {
          const S = AGING_STYLE[b.key];
          return (
            <li key={b.key} className="flex items-center gap-3 py-2.5 text-sm">
              <S.icon className="size-4 shrink-0" style={{ color: S.color }} aria-hidden="true" />
              <span className="flex-1">{b.label}</span>
              <span className="w-16 text-right text-muted-foreground tabular-nums">
                {b.count} {b.count === 1 ? "plan" : "plans"}
              </span>
              <span className={cn("w-28 text-right font-medium tabular-nums", !b.balance && "text-muted-foreground")}>{pkr(b.balance)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
