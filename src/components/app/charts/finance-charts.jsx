"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
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

// ---------- generic pieces used by all three dashboards ----------

const countFmt = (n) => Math.round(n).toLocaleString("en-PK");

function SeriesTooltip({ money }) {
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
                {name}
              </span>
              <span className="font-medium tabular-nums text-foreground">{money ? pkr(value) : countFmt(value)}</span>
            </div>
          )}
        />
      }
    />
  );
}

/**
 * Columns per month for one or more series on ONE axis.
 * series = [{ key, label, color: "var(--viz-1)" }]; stacked puts them in one column.
 */
export function ColumnChart({ data, series, stacked = false, money = true, height = "h-72" }) {
  const config = Object.fromEntries(series.map((s) => [s.key, { label: s.label, color: s.color }]));
  return (
    <ChartContainer config={config} className={cn("aspect-auto w-full", height)}>
      <BarChart data={data} barGap={2} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
        <XAxis dataKey="label" {...axisProps} tickMargin={8} interval="preserveStartEnd" />
        <YAxis {...axisProps} width={money ? 44 : 28} tickFormatter={money ? compact : countFmt} allowDecimals={false} />
        <SeriesTooltip money={money} />
        {series.length > 1 && <ChartLegend content={<ChartLegendContent />} />}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={`var(--color-${s.key})`}
            stackId={stacked ? "s" : undefined}
            stroke={stacked ? "var(--card)" : undefined}
            strokeWidth={stacked ? 1 : 0}
            radius={!stacked || i === series.length - 1 ? [4, 4, 0, 0] : 0}
            maxBarSize={stacked ? 22 : 18}
          />
        ))}
      </BarChart>
    </ChartContainer>
  );
}

/** One money series over time as a line with a soft fill (e.g. cash position). */
export function AreaTrend({ data, dataKey, label, height = "h-56" }) {
  const config = { [dataKey]: { label, color: "var(--viz-1)" } };
  return (
    <ChartContainer config={config} className={cn("aspect-auto w-full", height)}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`fill-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`var(--color-${dataKey})`} stopOpacity={0.18} />
            <stop offset="100%" stopColor={`var(--color-${dataKey})`} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--viz-grid)" />
        <XAxis dataKey="label" {...axisProps} tickMargin={8} interval="preserveStartEnd" />
        <YAxis {...axisProps} width={44} tickFormatter={compact} />
        <ChartTooltip cursor={{ stroke: "var(--border)" }} content={<ChartTooltipContent indicator="line" formatter={(v) => <span className="font-medium tabular-nums">{pkr(v)}</span>} />} />
        <Area type="monotone" dataKey={dataKey} name={label} stroke={`var(--color-${dataKey})`} strokeWidth={2} fill={`url(#fill-${dataKey})`} activeDot={{ r: 4, strokeWidth: 2, stroke: "var(--card)" }} />
      </AreaChart>
    </ChartContainer>
  );
}

/** Tiny trend line for a KPI tile (no axes; hover shows the month and value). */
export function Sparkline({ data, dataKey, money = true, color = "var(--viz-1)" }) {
  const config = { [dataKey]: { label: "Value", color } };
  return (
    <ChartContainer config={config} className="aspect-auto h-10 w-full">
      <AreaChart data={data} margin={{ top: 4, right: 2, left: 2, bottom: 2 }}>
        <defs>
          <linearGradient id={`spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={`var(--color-${dataKey})`} stopOpacity={0.16} />
            <stop offset="100%" stopColor={`var(--color-${dataKey})`} stopOpacity={0} />
          </linearGradient>
        </defs>
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideIndicator
              labelFormatter={(_, p) => p?.[0]?.payload?.label}
              formatter={(v) => <span className="font-medium tabular-nums">{money ? pkr(v) : countFmt(v)}</span>}
            />
          }
        />
        <Area type="monotone" dataKey={dataKey} stroke={`var(--color-${dataKey})`} strokeWidth={2} fill={`url(#spark-${dataKey})`} dot={false} activeDot={{ r: 3, strokeWidth: 2, stroke: "var(--card)" }} isAnimationActive />
      </AreaChart>
    </ChartContainer>
  );
}

/** Ranked bars for counts or money with an optional second line ("3 bikes"). */
export function RankBars({ items, money = true, tone = "in", unit, empty = "Nothing to show." }) {
  const visible = items.filter((x) => (x.value ?? 0) > 0 || (x.count ?? 0) > 0);
  if (!visible.length) return <p className="py-10 text-center text-sm text-muted-foreground">{empty}</p>;
  const max = Math.max(1, ...visible.map((x) => (money ? x.value : x.count)));
  const color = tone === "in" ? "var(--viz-1)" : tone === "alt" ? "var(--viz-3)" : "var(--viz-2)";
  return (
    <ul className="space-y-3.5">
      {visible.map((x) => {
        const v = money ? x.value : x.count;
        return (
          <li key={x.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-muted-foreground">
                {x.label}
                {money && x.count != null && unit && (
                  <span className="text-xs">
                    {" "}
                    · {x.count} {x.count === 1 ? unit[0] : unit[1]}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-medium tabular-nums">{money ? pkr(v) : countFmt(v)}</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted" role="img" aria-label={`${x.label}: ${money ? pkr(v) : countFmt(v)}`}>
              <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${(v / max) * 100}%`, background: color }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}
