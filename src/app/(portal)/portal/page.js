import { Suspense } from "react";
import { AlarmClockIcon, CalendarClockIcon, CheckCircle2Icon, FileTextIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PAYMENT_KIND_LABELS, PlanProgress } from "@/components/app/plan-ui";
import { HeaderSkeleton } from "@/components/app/skeletons";
import { requireCustomerPage } from "@/server/auth/current";
import { getMyPlans } from "@/server/services/installments";
import { formatBusinessDate } from "@/lib/business-date";
import { formatPKR } from "@/lib/format";

export const metadata = { title: "My account" };

export default function PortalHomePage() {
  return (
    <Suspense fallback={<HeaderSkeleton />}>
      <PortalContent />
    </Suspense>
  );
}

async function PortalContent() {
  const actor = await requireCustomerPage();
  // Only the signed-in customer's own plans: the id comes from the session, never the URL.
  const plans = await getMyPlans(actor);
  const owed = plans.filter((p) => p.status === "active").reduce((s, p) => s + p.progress.balance, 0);

  return (
    <div className="flex flex-col gap-6 animate-in fade-in-0 slide-in-from-bottom-1 duration-300">
      <div>
        <p className="text-sm text-muted-foreground">Assalam-o-Alaikum,</p>
        <h1 className="text-2xl font-semibold tracking-tight">{actor.name}</h1>
        {plans.length > 0 && (
          <p className="mt-1 text-sm text-muted-foreground">
            {owed > 0 ? (
              <>
                Total remaining: <span className="font-semibold text-foreground tabular-nums">{formatPKR(owed)}</span>
              </>
            ) : (
              "All your plans are fully paid. Thank you!"
            )}
          </p>
        )}
      </div>

      {plans.length === 0 ? (
        <Card>
          <CardContent>
            <Empty className="py-12">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <FileTextIcon />
                </EmptyMedia>
                <EmptyTitle>No plans yet</EmptyTitle>
                <EmptyDescription>Your installment plans and payments will appear here.</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
      ) : (
        plans.map((p) => (
          <Card key={p.id} className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b py-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{p.item}</CardTitle>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Account <span className="font-mono">#{p.accountNumber}</span> · since {formatBusinessDate(p.agreementDate)}
                  </p>
                </div>
                {p.status === "completed" ? (
                  <Badge className="gap-1 bg-success/12 text-success hover:bg-success/12">
                    <CheckCircle2Icon /> Paid off
                  </Badge>
                ) : p.progress.overdue ? (
                  <Badge className="gap-1 bg-destructive/12 text-destructive hover:bg-destructive/12">
                    <AlarmClockIcon /> {formatPKR(p.progress.overdue.amount)} overdue
                  </Badge>
                ) : (
                  <Badge variant="outline">Up to date</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4 py-5">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-semibold tabular-nums">{formatPKR(p.agreedTotal)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Paid</p>
                  <p className="font-semibold tabular-nums">{formatPKR(p.progress.paid)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Remaining</p>
                  <p className="font-semibold tabular-nums">{formatPKR(p.progress.balance)}</p>
                </div>
              </div>
              <PlanProgress percent={p.progress.percent} status={p.status} overdue={p.progress.overdue} className="h-2" />
              {p.progress.overdue && (
                <p className="flex items-start gap-2 rounded-lg bg-destructive/8 px-3 py-2 text-sm text-destructive">
                  <AlarmClockIcon className="mt-0.5 size-4 shrink-0" />
                  <span>
                    Please pay <span className="font-semibold tabular-nums">{formatPKR(p.progress.overdue.amount)}</span>. It was due on{" "}
                    {formatBusinessDate(p.progress.overdue.since)}.
                  </span>
                </p>
              )}
              {p.progress.nextDue && (
                <p className="flex items-center gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm">
                  <CalendarClockIcon className="size-4 text-muted-foreground" />
                  Next: <span className="font-medium tabular-nums">{formatPKR(p.progress.nextDue.amount)}</span> by{" "}
                  {formatBusinessDate(p.progress.nextDue.dueDate)}
                </p>
              )}
            </CardContent>
            {p.payments.length > 0 && (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="pl-4">Date</TableHead>
                    <TableHead className="hidden sm:table-cell">Receipt</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="pr-4 text-right">Remaining</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {p.payments
                    .slice()
                    .reverse()
                    .map((x) => (
                      <TableRow key={x.id}>
                        <TableCell className="pl-4">
                          <span className="whitespace-nowrap">{formatBusinessDate(x.paidAt)}</span>
                          {x.kind !== "installment" && <span className="block text-xs text-muted-foreground">{PAYMENT_KIND_LABELS[x.kind]}</span>}
                        </TableCell>
                        <TableCell className="hidden font-mono text-xs sm:table-cell">{x.receiptNumber ?? "—"}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatPKR(x.amount)}</TableCell>
                        <TableCell className="pr-4 text-right tabular-nums">{formatPKR(x.balanceAfter)}</TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            )}
          </Card>
        ))
      )}
    </div>
  );
}
