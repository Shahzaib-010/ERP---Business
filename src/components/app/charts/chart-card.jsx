"use client";

import { useState } from "react";
import { BarChart3Icon, TableIcon } from "lucide-react";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

/**
 * Card around a chart with a Chart / Table switch. The table carries every value, so the
 * chart never has to (dataviz: a table view always exists).
 * table = { columns: [{ key, label, align? }], rows: [{ key, ...values }] }
 */
export function ChartCard({ title, description, table, action, className, children }) {
  const [view, setView] = useState("chart");
  return (
    <Card className={cn("gap-4", className)}>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
        <CardAction className="flex items-center gap-2">
          {action}
          {table && (
            <ToggleGroup type="single" size="sm" variant="outline" value={view} onValueChange={(v) => v && setView(v)} aria-label="Chart or table">
              <ToggleGroupItem value="chart" aria-label="Show chart">
                <BarChart3Icon />
              </ToggleGroupItem>
              <ToggleGroupItem value="table" aria-label="Show table">
                <TableIcon />
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="flex-1">
        {view === "chart" || !table ? (
          children
        ) : (
          <div className="max-h-80 overflow-auto rounded-lg border">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur">
                <TableRow>
                  {table.columns.map((c) => (
                    <TableHead key={c.key} className={c.align === "right" ? "text-right" : undefined}>
                      {c.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {table.rows.map((r) => (
                  <TableRow key={r.key}>
                    {table.columns.map((c) => (
                      <TableCell key={c.key} className={cn(c.align === "right" && "text-right tabular-nums")}>
                        {r[c.key]}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
