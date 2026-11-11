import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  AlarmClockIcon,
  BikeIcon,
  CalendarClockIcon,
  CalendarIcon,
  FileSignatureIcon,
  HistoryIcon,
  PhoneIcon,
  ReceiptTextIcon,
  UserIcon,
  UserRoundCheckIcon,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityList } from "@/components/app/activity-list";
import { BreadcrumbLabel } from "@/components/app/breadcrumbs";
import { FlashToast } from "@/components/app/flash-toast";
import { PageBody } from "@/components/app/page-header";
import { ITEM_KIND_LABELS, PAYMENT_KIND_LABELS, PlanProgress, PlanStatusBadge } from "@/components/app/plan-ui";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { listEntityHistory } from "@/server/services/audit";
import { getNextNumbers, getPlan } from "@/server/services/installments";
import { NotFoundError } from "@/server/errors";
import { FREQUENCY_LABELS } from "@/lib/installment-schedule";
import { dateOnlyString, formatBusinessDate } from "@/lib/business-date";
import { formatDateTime, formatPKR } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { applyDiscountAction, recordPaymentAction, updateScheduleAction, voidPaymentAction } from "../actions";
import { PlanActions, VoidPaymentButton } from "./plan-dialogs";

export const metadata = { title: "Installment plan" };

const SAVED = {
  created: { title: "Plan created", description: "Record payments here as they come in." },
  updated: "Plan details saved",
  unchanged: { title: "Nothing changed", tone: "info" },
};

const ROW_STATUS = {
  paid: { label: "Paid", className: "bg-success/12 text-success" },
  partial: { label: "Part paid", className: "bg-warning/15 text-warning-foreground dark:text-warning" },
  due: { label: "Due today", className: "bg-warning/15 text-warning-foreground dark:text-warning" },
  late: { label: "Late", className: "bg-destructive/12 text-destructive" },
  upcoming: { label: "Upcoming", className: "bg-muted text-muted-foreground" },
};

export default function PlanPage({ params }) {
  return (
    <Suspense fallback={<PageSkeleton variant="cards" />}>
      <PlanContent params={params} />
    </Suspense>
  );
}

function scheduleText(s) {
  if (!s) return "—";
  const amount = s.installmentAmount ? formatPKR(s.installmentAmount) : "No set amount";
  if (s.frequency === "monthly") return `${amount} monthly, due by day ${s.dueDayOfMonth}`;
  if (s.frequency === "custom") return `${amount} every ${s.intervalDays} days`;
  return `${amount} ${FREQUENCY_LABELS[s.frequency].toLowerCase()}`;
}

function Stat({ label, value, sub, tone }) {
  return (
    <div className="bg-card px-5 py-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums sm:text-2xl", tone)}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Term({ label, children }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2.5 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{children ?? "—"}</dd>
    </div>
  );
}

async function PlanContent({ params }) {
  const actor = await requireStaffPage("installments.view");
  const { id } = await params;
  let plan;
  try {
    plan = await getPlan(actor, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const [{ receiptNumber: nextReceipt }, history] = await Promise.all([
    getNextNumbers(actor),
    can(actor, "audit.view") ? listEntityHistory(actor, { entityType: "installmentPlan", entityId: plan.id }) : Promise.resolve(null),
  ]);
  const { progress } = plan;
  const active = plan.status === "active";
  const canVoid = can(actor, "payments.edit");
  const canDiscount = can(actor, "installments.discount");

  return (
    <PageBody>
      <BreadcrumbLabel segment={plan.id} label={`#${plan.accountNumber}`} />
      <FlashToast messages={SAVED} />

      {/* Header */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">#{plan.accountNumber}</h1>
            <PlanStatusBadge status={plan.status} overdue={progress.overdue} />
            {plan.previousAccountNumber && <Badge variant="outline">Previous #{plan.previousAccountNumber}</Badge>}
          </div>
          <p className="mt-1 text-lg">{plan.item.description}</p>
          {plan.bike && (
            <Link href={`/bikes/${plan.bike.id}`} className="mt-1 inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs hover:bg-muted">
              <BikeIcon className="size-3.5" /> <span className="font-mono font-semibold">B-{plan.bike.bikeNumber}</span> {plan.bike.label}
            </Link>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {plan.customer && (
              <Link href={`/customers/${plan.customer.id}`} className="inline-flex items-center gap-1.5 font-medium text-foreground hover:underline">
                <UserIcon className="size-4" /> {plan.customer.name}
              </Link>
            )}
            {plan.customer?.phones[0] && (
              <a href={`tel:${plan.customer.phones[0]}`} className="inline-flex items-center gap-1.5 font-mono hover:text-foreground">
                <PhoneIcon className="size-3.5" /> {formatPhone(plan.customer.phones[0])}
              </a>
            )}
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon className="size-3.5" /> Agreement {formatBusinessDate(plan.terms.agreementDate)}
            </span>
          </div>
        </div>
        <PlanActions
          planId={plan.id}
          active={active}
          balance={plan.balance}
          suggested={plan.schedule?.installmentAmount ?? 0}
          nextReceipt={nextReceipt}
          minDate={dateOnlyString(plan.terms.agreementDate)}
          schedule={plan.schedule}
          can={{ pay: can(actor, "payments.create"), edit: can(actor, "installments.edit"), discount: canDiscount }}
          actions={{
            pay: recordPaymentAction.bind(null, plan.id),
            schedule: updateScheduleAction.bind(null, plan.id),
            discount: applyDiscountAction.bind(null, plan.id),
          }}
        />
      </div>

      {progress.overdue && (
        <Alert variant="destructive" className="border-destructive/30 bg-destructive/5">
          <AlarmClockIcon />
          <AlertTitle>
            {progress.overdue.daysLate} {progress.overdue.daysLate === 1 ? "day" : "days"} late · {formatPKR(progress.overdue.amount)} overdue
          </AlertTitle>
          <AlertDescription>
            The oldest unpaid installment was due on {formatBusinessDate(progress.overdue.since)}
            {progress.overdue.installments > 1 ? ` (${progress.overdue.installments} installments behind)` : ""}.
          </AlertDescription>
        </Alert>
      )}

      {/* Figures */}
      <Card className="gap-0 overflow-hidden py-0">
        <div className="grid gap-px bg-border sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Total price" value={formatPKR(plan.agreedTotal)} sub={plan.terms.cashPrice != null ? `Cash price ${formatPKR(plan.terms.cashPrice)}` : null} />
          <Stat label="Received" value={formatPKR(progress.paid)} sub={progress.discount ? `+ ${formatPKR(progress.discount)} discount` : `${plan.ledger.filter((l) => l.status === "posted" && l.kind !== "discount").length} payments`} />
          <Stat label="Balance" value={formatPKR(plan.balance)} tone={plan.balance === 0 ? "text-success" : undefined} sub={plan.completedAt ? `Completed ${formatDateTime(plan.completedAt)}` : null} />
          <Stat
            label={progress.nextDue ? "Next due" : "Schedule"}
            value={progress.nextDue ? formatPKR(progress.nextDue.amount) : plan.status === "completed" ? "Paid off" : "—"}
            sub={progress.nextDue ? `${progress.nextDue.label} · ${formatBusinessDate(progress.nextDue.dueDate)}` : scheduleText(plan.schedule)}
          />
        </div>
        <div className="flex items-center gap-3 border-t px-5 py-3">
          <PlanProgress percent={progress.percent} status={plan.status} overdue={progress.overdue} className="h-2" />
          <span className="w-12 text-right text-sm font-medium tabular-nums">{progress.percent}%</span>
        </div>
      </Card>

      <Tabs defaultValue="payments" className="gap-4">
        <TabsList className="w-full justify-start overflow-x-auto sm:w-auto">
          <TabsTrigger value="payments">
            <ReceiptTextIcon /> Payments
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <CalendarClockIcon /> Schedule
          </TabsTrigger>
          <TabsTrigger value="agreement">
            <FileSignatureIcon /> Agreement
          </TabsTrigger>
          {history && (
            <TabsTrigger value="history">
              <HistoryIcon /> History
            </TabsTrigger>
          )}
        </TabsList>

        {/* Payments ledger, like the paper card */}
        <TabsContent value="payments">
          <Card className="gap-0 overflow-hidden py-0">
            {plan.ledger.length === 0 ? (
              <Empty className="py-12">
                <EmptyHeader>
                  <EmptyMedia variant="icon">
                    <ReceiptTextIcon />
                  </EmptyMedia>
                  <EmptyTitle>No payments yet</EmptyTitle>
                  <EmptyDescription>Payments you record will appear here with the running balance.</EmptyDescription>
                </EmptyHeader>
              </Empty>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="pl-4">Date</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                    <TableHead className="hidden md:table-cell">Entered by</TableHead>
                    {canVoid && <TableHead className="w-10 pr-4" />}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plan.ledger.map((p) => {
                    const voided = p.status === "voided";
                    return (
                      <TableRow key={p.id} className={voided ? "text-muted-foreground" : undefined}>
                        <TableCell className="pl-4 whitespace-nowrap">
                          <span className={voided ? "line-through" : undefined}>{formatBusinessDate(p.paidAt)}</span>
                          {voided && (
                            <p className="max-w-[14rem] text-xs whitespace-normal text-destructive">
                              Voided by {p.voidedBy}: {p.voidReason}
                            </p>
                          )}
                          {!voided && p.note && <p className="max-w-[14rem] truncate text-xs text-muted-foreground">{p.note}</p>}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{p.receiptNumber ?? "—"}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge variant={p.kind === "installment" ? "outline" : "secondary"} className={p.kind === "discount" ? "bg-warning/15" : undefined}>
                            {PAYMENT_KIND_LABELS[p.kind]}
                          </Badge>
                        </TableCell>
                        <TableCell className={cn("text-right font-medium tabular-nums", voided && "line-through")}>
                          {p.kind === "discount" ? "−" : ""}
                          {formatPKR(p.amount)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{p.balanceAfter != null ? formatPKR(p.balanceAfter) : "—"}</TableCell>
                        <TableCell className="hidden text-sm text-muted-foreground md:table-cell">{p.enteredBy}</TableCell>
                        {canVoid && (
                          <TableCell className="pr-4 text-right">
                            {!voided && (p.kind !== "discount" || canDiscount) && (
                              <VoidPaymentButton action={voidPaymentAction.bind(null, p.id)} label={`${PAYMENT_KIND_LABELS[p.kind].toLowerCase()} of ${formatPKR(p.amount)}`} />
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Expected schedule */}
        <TabsContent value="schedule">
          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader className="border-b py-4">
              <CardTitle className="text-base">Expected payments</CardTitle>
              <CardDescription>{scheduleText(plan.schedule)}. Extra payments count towards the next installments.</CardDescription>
            </CardHeader>
            {progress.rows.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">No schedule set for this plan.</p>
            ) : (
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="pl-4">#</TableHead>
                    <TableHead>Due</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="hidden text-right sm:table-cell">Covered</TableHead>
                    <TableHead className="pr-4 text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {progress.rows.map((r) => (
                    <TableRow key={r.n}>
                      <TableCell className="pl-4 text-muted-foreground">{r.n === 0 ? "Adv." : r.n}</TableCell>
                      <TableCell className="whitespace-nowrap">{formatBusinessDate(r.dueDate)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatPKR(r.amount)}</TableCell>
                      <TableCell className="hidden text-right text-muted-foreground tabular-nums sm:table-cell">{formatPKR(r.paidTowards)}</TableCell>
                      <TableCell className="pr-4 text-right">
                        <Badge className={cn("hover:bg-inherit", ROW_STATUS[r.status].className)}>{ROW_STATUS[r.status].label}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Original agreement */}
        <TabsContent value="agreement" className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agreement terms</CardTitle>
              <CardDescription>As agreed on {formatBusinessDate(plan.terms.agreementDate)}. Never changed afterwards.</CardDescription>
            </CardHeader>
            <CardContent>
              <dl>
                <Term label="Cash price">{plan.terms.cashPrice != null ? formatPKR(plan.terms.cashPrice) : null}</Term>
                <Term label="Markup">{plan.terms.markup != null ? formatPKR(plan.terms.markup) : null}</Term>
                <Term label="Total price">{formatPKR(plan.terms.agreedTotal)}</Term>
                <Term label="Advance">{formatPKR(plan.terms.advanceAmount)}</Term>
                <Term label="Balance after advance">{formatPKR(plan.terms.agreedTotal - plan.terms.advanceAmount)}</Term>
                <Term label="Agreed schedule">{scheduleText(plan.terms.schedule)}</Term>
                {JSON.stringify(plan.terms.schedule) !== JSON.stringify(plan.schedule) && <Term label="Current schedule">{scheduleText(plan.schedule)}</Term>}
              </dl>
            </CardContent>
          </Card>
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Item</CardTitle>
              </CardHeader>
              <CardContent>
                <dl>
                  <Term label="Type">{ITEM_KIND_LABELS[plan.item.kind]}</Term>
                  <Term label="Item">{plan.item.description}</Term>
                  <Term label="Model / year">{plan.item.model || null}</Term>
                  <Term label="Registration / serial">{plan.item.serialNumber ? <span className="font-mono">{plan.item.serialNumber}</span> : null}</Term>
                </dl>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <UserRoundCheckIcon className="size-4 text-muted-foreground" /> Guarantors
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {plan.guarantors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No guarantor on this plan.</p>
                ) : (
                  plan.guarantors.map((g, i) => (
                    <div key={i} className="rounded-lg border p-3 text-sm">
                      <p className="font-medium">
                        {g.name}
                        {g.fatherName && <span className="font-normal text-muted-foreground"> · s/o {g.fatherName}</span>}
                      </p>
                      <p className="mt-1 text-muted-foreground">
                        {[g.cnicMasked && <span key="c" className="font-mono">{g.cnicMasked}</span>, g.profession, g.address].filter(Boolean).reduce((acc, x, j) => (j ? [...acc, " · ", x] : [x]), [])}
                      </p>
                      {g.phones.map((p) => (
                        <a key={p} href={`tel:${p}`} className="mt-1 inline-flex items-center gap-1.5 font-mono text-xs hover:underline">
                          <PhoneIcon className="size-3" /> {formatPhone(p)}
                        </a>
                      ))}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            {plan.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Notes</CardTitle>
                </CardHeader>
                <CardContent className="text-sm whitespace-pre-line">{plan.notes}</CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {history && (
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">History</CardTitle>
                <CardDescription>Every change to this plan and its payments, newest first.</CardDescription>
              </CardHeader>
              <CardContent>
                <ActivityList events={history} showChanges emptyText="No changes recorded." />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {!active && plan.status === "completed" && (
        <p className="text-center text-sm text-muted-foreground">
          This plan is fully settled.{" "}
          {plan.customer && can(actor, "installments.create") && (
            <Button variant="link" asChild className="h-auto p-0">
              <Link href={`/plans/new?customerId=${plan.customer.id}`}>Start a new plan for {plan.customer.name}</Link>
            </Button>
          )}
        </p>
      )}
    </PageBody>
  );
}
