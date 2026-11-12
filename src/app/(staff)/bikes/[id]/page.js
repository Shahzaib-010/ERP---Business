import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { BikeIcon, CalendarIcon, FileTextIcon, HashIcon, HistoryIcon, PhoneIcon, ShoppingBagIcon, StoreIcon, UserIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ActivityList } from "@/components/app/activity-list";
import { DocumentsSection } from "@/components/app/documents/documents-section";
import { BikeStatusBadge, ConditionBadge, OwedBadge, bikeNo } from "@/components/app/bike-ui";
import { BreadcrumbLabel } from "@/components/app/breadcrumbs";
import { FlashToast } from "@/components/app/flash-toast";
import { PageBody } from "@/components/app/page-header";
import { PlanStatusBadge } from "@/components/app/plan-ui";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { listEntityHistory } from "@/server/services/audit";
import { getBike } from "@/server/services/bikes";
import { getNextNumbers } from "@/server/services/installments";
import { NotFoundError } from "@/server/errors";
import { dateOnlyString, formatBusinessDate } from "@/lib/business-date";
import { formatPKR } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";
import { cancelSaleAction, paySellerAction, sellCashAction, voidSellerPaymentAction } from "../actions";
import { BikeActions, VoidSellerPaymentButton } from "./bike-dialogs";
import { PrintLink } from "@/components/app/print-link";

export const metadata = { title: "Bike" };

const SAVED = {
  created: { title: "Bike added to the register", description: "Sell it from this page when a customer buys it." },
  updated: "Bike details saved",
  unchanged: { title: "Nothing changed", tone: "info" },
};

export default function BikePage({ params }) {
  return (
    <Suspense fallback={<PageSkeleton variant="cards" />}>
      <BikeContent params={params} />
    </Suspense>
  );
}

function Row({ label, children, mono }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2.5 text-sm last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("text-right font-medium", mono && "font-mono")}>{children || <span className="font-normal text-muted-foreground">—</span>}</dd>
    </div>
  );
}

async function BikeContent({ params }) {
  const actor = await requireStaffPage("bikes.view");
  const { id } = await params;
  let b;
  try {
    b = await getBike(actor, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const [{ receiptNumber: nextReceipt }, history] = await Promise.all([
    getNextNumbers(actor),
    can(actor, "audit.view") ? listEntityHistory(actor, { entityType: "bike", entityId: b.id }) : Promise.resolve(null),
  ]);
  const canVoid = can(actor, "payments.edit");
  const canPrint = can(actor, "receipts.view");
  const showActions = canVoid || canPrint;
  const sale = b.saleDetail;

  return (
    <PageBody>
      <BreadcrumbLabel segment={b.id} label={bikeNo(b.bikeNumber)} />
      <FlashToast messages={SAVED} />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className="hidden size-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm sm:flex">
            <BikeIcon className="size-7 text-brand dark:text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-sm font-semibold text-muted-foreground">{bikeNo(b.bikeNumber)}</span>
              <BikeStatusBadge status={b.status} />
              <ConditionBadge condition={b.condition} />
              <OwedBadge amount={b.purchase.payable} />
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{b.label}</h1>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {b.registrationNumber && (
                <span className="inline-flex items-center gap-1.5 font-mono">
                  <HashIcon className="size-3.5" /> {b.registrationNumber}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5">
                <CalendarIcon className="size-3.5" /> Bought {formatBusinessDate(b.purchase.date)}
              </span>
            </div>
          </div>
        </div>
        <BikeActions
          bikeId={b.id}
          inStock={b.status === "in_stock"}
          payable={b.purchase.payable}
          purchaseDate={dateOnlyString(b.purchase.date)}
          nextReceipt={nextReceipt}
          saleMode={sale?.mode ?? null}
          can={{
            sell: can(actor, "bikes.create"),
            plan: can(actor, "installments.create"),
            paySeller: can(actor, "bikes.create"),
            edit: can(actor, "bikes.edit"),
            cancel: can(actor, "bikes.edit") && can(actor, "payments.edit"),
          }}
          actions={{
            pay: paySellerAction.bind(null, b.id),
            sell: sellCashAction.bind(null, b.id),
            cancel: cancelSaleAction.bind(null, b.id),
          }}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Bike details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent>
            <dl>
              <Row label="Make">{b.make}</Row>
              <Row label="Model">{b.model}</Row>
              <Row label="Year">{b.modelYear}</Row>
              <Row label="Colour">{b.color}</Row>
              <Row label="Registration" mono>{b.registrationNumber}</Row>
              <Row label="Engine no." mono>{b.engineNumber}</Row>
              <Row label="Chassis no." mono>{b.chassisNumber}</Row>
            </dl>
            {b.notes && <p className="mt-3 rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-line">{b.notes}</p>}
          </CardContent>
        </Card>

        {/* Purchase and payments to seller */}
        <Card className="gap-0 overflow-hidden py-0 lg:col-span-2">
          <CardHeader className="border-b py-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <StoreIcon className="size-4 text-muted-foreground" /> Purchase
            </CardTitle>
            <CardDescription>
              From <span className="font-medium text-foreground">{b.seller.name}</span>
              {b.seller.phone && (
                <a href={`tel:${b.seller.phone}`} className="ml-2 inline-flex items-center gap-1 font-mono hover:underline">
                  <PhoneIcon className="size-3" /> {formatPhone(b.seller.phone)}
                </a>
              )}
              {b.seller.cnicMasked && <span className="ml-2 font-mono">{b.seller.cnicMasked}</span>}
              {b.seller.address && <span className="block">{b.seller.address}</span>}
            </CardDescription>
          </CardHeader>
          <div className="grid grid-cols-3 gap-px border-b bg-border">
            {[
              { label: "Purchase price", value: formatPKR(b.purchase.price) },
              { label: "Paid to seller", value: formatPKR(b.purchase.paid) },
              { label: "Still owed", value: formatPKR(b.purchase.payable), tone: b.purchase.payable > 0 ? "text-foreground" : "text-success" },
            ].map((x) => (
              <div key={x.label} className="min-w-0 bg-card px-3 py-3 sm:px-5">
                <p className="truncate text-xs text-muted-foreground">{x.label}</p>
                <p className={cn("mt-0.5 text-sm font-semibold whitespace-nowrap tabular-nums sm:text-lg", x.tone)}>{x.value}</p>
              </div>
            ))}
          </div>
          {b.sellerPayments.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground">Nothing paid to the seller yet.</p>
          ) : (
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="pl-4 sm:pl-5">Date</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="hidden text-right sm:table-cell">Still owed</TableHead>
                  <TableHead className="hidden sm:table-cell">Entered by</TableHead>
                  {showActions && <TableHead className="w-16 pr-5" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {b.sellerPayments.map((p) => {
                  const voided = p.status === "voided";
                  return (
                    <TableRow key={p.id} className={voided ? "text-muted-foreground" : undefined}>
                      <TableCell className="pl-4 sm:pl-5">
                        <span className={voided ? "line-through" : undefined}>{formatBusinessDate(p.paidAt)}</span>
                        {p.kind === "at_purchase" && !voided && <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">at purchase</span>}
                        {voided && <p className="text-xs text-destructive">Voided by {p.voidedBy}: {p.voidReason}</p>}
                        {!voided && p.note && <p className="text-xs text-muted-foreground">{p.note}</p>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        <span className={cn(voided && "line-through")}>{formatPKR(p.amount)}</span>
                        {/* Phones: what is still owed, under the amount (its column is hidden) */}
                        {p.owedAfter != null && <p className="text-xs text-muted-foreground sm:hidden">Owed {formatPKR(p.owedAfter)}</p>}
                      </TableCell>
                      <TableCell className="hidden text-right tabular-nums sm:table-cell">{p.owedAfter != null ? formatPKR(p.owedAfter) : "—"}</TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground sm:table-cell">{p.enteredBy}</TableCell>
                      {showActions && (
                        <TableCell className="pr-5 text-right whitespace-nowrap">
                          {canPrint && <PrintLink href={`/receipts/seller-payment/${p.id}`} label="Print voucher" />}
                          {canVoid && !voided && <VoidSellerPaymentButton action={voidSellerPaymentAction.bind(null, p.id)} label={`payment of ${formatPKR(p.amount)}`} />}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Sale */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShoppingBagIcon className="size-4 text-muted-foreground" /> Sale
          </CardTitle>
          {!sale && <CardDescription>Not sold yet. Use “Sell bike” when a customer buys it, for cash or on installments.</CardDescription>}
        </CardHeader>
        {sale && (
          <CardContent className="grid gap-6 md:grid-cols-2">
            <dl>
              <Row label="Sold to">
                {sale.customer ? (
                  <Link href={`/customers/${sale.customer.id}`} className="inline-flex items-center gap-1.5 hover:underline">
                    <UserIcon className="size-3.5" /> {sale.customer.name}
                  </Link>
                ) : null}
              </Row>
              <Row label="Date">{formatBusinessDate(sale.date)}</Row>
              <Row label="How">
                <Badge variant="outline">{sale.mode === "cash" ? "Cash" : "Installments"}</Badge>
              </Row>
              <Row label={sale.mode === "cash" ? "Sale price" : "Total price (plan)"}>{formatPKR(sale.price)}</Row>
              {sale.cashPrice != null && <Row label="Cash price on agreement">{formatPKR(sale.cashPrice)}</Row>}
              {sale.mode === "cash" && <Row label="Receipt no." mono>{sale.receiptNumber}</Row>}
              {sale.soldBy && <Row label="Recorded by">{sale.soldBy}</Row>}
            </dl>
            {sale.plan ? (
              <Link href={`/plans/${sale.plan.id}`} className="group flex flex-col justify-between rounded-xl border p-4 transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileTextIcon className="size-3.5" /> Installment plan
                    </p>
                    <p className="mt-1 font-mono text-lg font-semibold group-hover:underline">#{sale.plan.accountNumber}</p>
                  </div>
                  <PlanStatusBadge status={sale.plan.status} />
                </div>
                <p className="mt-4 text-sm">
                  Balance <span className="font-semibold tabular-nums">{formatPKR(sale.plan.balance)}</span>
                </p>
              </Link>
            ) : (
              <div className="space-y-3">
                {canPrint && sale.mode === "cash" && <PrintLink href={`/receipts/bike-sale/${b.id}`} withText />}
                {sale.note && <p className="rounded-lg bg-muted/50 p-3 text-sm whitespace-pre-line">{sale.note}</p>}
              </div>
            )}
          </CardContent>
        )}
      </Card>

      <DocumentsSection actor={actor} ownerType="bike" ownerId={b.id} />

      {history && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <HistoryIcon className="size-4 text-muted-foreground" /> History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityList events={history} showChanges emptyText="No changes recorded." />
          </CardContent>
        </Card>
      )}
    </PageBody>
  );
}
