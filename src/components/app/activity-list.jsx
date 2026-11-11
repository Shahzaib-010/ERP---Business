import Link from "next/link";
import { HistoryIcon } from "lucide-react";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { AUDIT_FIELD_LABELS, auditActionLabel } from "@/lib/audit-labels";
import { formatDateTime, formatRelative } from "@/lib/format";
import { formatBusinessDate } from "@/lib/business-date";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}T00:00:00(\.000)?Z$/;

function show(v) {
  if (v === null || v === undefined || v === "") return "—";
  if (v instanceof Date) v = v.toISOString();
  if (typeof v === "string" && ISO_DAY.test(v)) return formatBusinessDate(v);
  if (Array.isArray(v)) return v.length ? v.map(show).join(", ") : "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  if (typeof v === "number") return v.toLocaleString("en-PK");
  if (typeof v === "object") {
    const parts = Object.entries(v)
      .filter(([, x]) => x !== null && x !== undefined && x !== "")
      .map(([k, x]) => `${AUDIT_FIELD_LABELS[k] ?? k.replace(/([A-Z])/g, " $1").toLowerCase()}: ${show(x)}`);
    return parts.length ? parts.join(" · ") : "—";
  }
  return String(v);
}

function entityHref(e) {
  if (e.entityType === "customer" && e.entityId) return `/customers/${e.entityId}`;
  if (e.entityType === "installmentPlan" && e.entityId) return `/plans/${e.entityId}`;
  if (e.entityType === "bike" && e.entityId) return `/bikes/${e.entityId}`;
  return null;
}

/** Timeline of audit events. `showEntity` adds the record name (dashboard view). */
export function ActivityList({ events, showEntity = false, showChanges = false, emptyText = "No activity yet." }) {
  if (!events?.length) {
    return (
      <Empty className="border-0 py-8">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HistoryIcon />
          </EmptyMedia>
          <EmptyTitle className="text-sm">Nothing here yet</EmptyTitle>
          <EmptyDescription>{emptyText}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <ol className="relative space-y-5 border-l pl-5">
      {events.map((e) => {
        const href = showEntity ? entityHref(e) : null;
        return (
          <li key={e.id} className="relative">
            <span className="absolute top-1.5 -left-[25px] size-2.5 rounded-full border-2 border-background bg-primary ring-2 ring-primary/20" />
            <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-medium">{auditActionLabel(e.action)}</span>
              {showEntity && (e.entityName || e.entityType === "installmentPlan" || e.entityType === "bike") && (
                <>
                  {href ? (
                    <Link href={href} className="text-primary hover:underline">
                      {e.entityName ?? (e.entityType === "bike" ? "bike" : "plan")}
                    </Link>
                  ) : (
                    <span>{e.entityName}</span>
                  )}
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              by {e.actorName} · <time title={formatDateTime(e.createdAt)}>{formatRelative(e.createdAt)}</time>
            </p>
            {showChanges && e.changes.length > 0 && (
              <ul className="mt-2 space-y-1 rounded-lg border bg-muted/40 p-2.5 text-xs">
                {e.changes.map((c) => (
                  <li key={c.field} className="grid gap-1 sm:grid-cols-[8rem_1fr]">
                    <span className="text-muted-foreground">{AUDIT_FIELD_LABELS[c.field] ?? c.field}</span>
                    <span className="break-words">
                      <span className="text-muted-foreground line-through">{show(c.from)}</span>
                      <span className="mx-1.5 text-muted-foreground">→</span>
                      <span className="font-medium">{show(c.to)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {e.reason && <p className="mt-1 text-xs italic text-muted-foreground">Reason: {e.reason}</p>}
          </li>
        );
      })}
    </ol>
  );
}
