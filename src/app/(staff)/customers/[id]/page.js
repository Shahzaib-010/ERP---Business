import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  BriefcaseIcon,
  FilePlus2Icon,
  CalendarIcon,
  FileTextIcon,
  HistoryIcon,
  HomeIcon,
  IdCardIcon,
  KeyRoundIcon,
  MapPinIcon,
  PencilIcon,
  PhoneIcon,
  ReceiptTextIcon,
  StickyNoteIcon,
  UserIcon,
  FolderLockIcon,
} from "lucide-react";
import { DocumentsSection } from "@/components/app/documents/documents-section";
import { RECORD_TABS } from "@/components/app/record-tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityList } from "@/components/app/activity-list";
import { BreadcrumbLabel } from "@/components/app/breadcrumbs";
import { CopyButton } from "@/components/app/copy-button";
import { FlashToast } from "@/components/app/flash-toast";
import { PageBody } from "@/components/app/page-header";
import { PageSkeleton } from "@/components/app/skeletons";
import { requireStaffPage } from "@/server/auth/current";
import { can } from "@/server/permissions";
import { getCustomer } from "@/server/services/customers";
import { listEntityHistory } from "@/server/services/audit";
import { listPlansForCustomer } from "@/server/services/installments";
import { listBikesForCustomer } from "@/server/services/bikes";
import { PlanProgress, PlanStatusBadge } from "@/components/app/plan-ui";
import { formatBusinessDate } from "@/lib/business-date";
import { NotFoundError } from "@/server/errors";
import { formatDate, formatDateTime, formatPKR, initials } from "@/lib/format";
import { formatPhone, whatsappUrl } from "@/lib/phone";
import { WhatsAppIcon } from "@/components/app/whatsapp-icon";
import { disablePortalAction, setPortalPasswordAction } from "../actions";
import { PortalAccess } from "./portal-access";

export const metadata = { title: "Customer" };

const SAVED_MESSAGES = {
  created: { title: "Customer added", description: "You can now create plans and record sales for them." },
  updated: "Changes saved",
  unchanged: { title: "Nothing changed", tone: "info" },
};

export default function CustomerPage({ params }) {
  return (
    <Suspense fallback={<PageSkeleton variant="form" />}>
      <CustomerContent params={params} />
    </Suspense>
  );
}

function Detail({ icon: Icon, label, children, mono }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon className="size-4" />
      </div>
      <div className="min-w-0">
        <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
        <dd className={`mt-0.5 text-sm break-words whitespace-pre-line ${mono ? "font-mono" : ""}`}>
          {children || <span className="text-muted-foreground">Not recorded</span>}
        </dd>
      </div>
    </div>
  );
}

async function CustomerContent({ params }) {
  const actor = await requireStaffPage("customers.view");
  const { id } = await params;

  let c;
  try {
    c = await getCustomer(actor, id);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const canEdit = can(actor, "customers.edit");
  const canSeeHistory = can(actor, "audit.view");
  const canSeeDocuments = can(actor, "documents.view");
  const canSeePlans = can(actor, "installments.view");
  const canSeeBikes = can(actor, "bikes.view");
  const [history, plans, bikes] = await Promise.all([
    canSeeHistory ? listEntityHistory(actor, { entityType: "customer", entityId: c.id }) : Promise.resolve([]),
    canSeePlans ? listPlansForCustomer(actor, c.id) : Promise.resolve([]),
    canSeeBikes ? listBikesForCustomer(actor, c.id) : Promise.resolve([]),
  ]);
  const cashBikes = bikes.filter((b) => b.sale?.mode === "cash");
  const canCreatePlan = can(actor, "installments.create");
  const owed = plans.filter((p) => p.status === "active").reduce((sum, p) => sum + p.balance, 0);

  return (
    <PageBody>
      <BreadcrumbLabel segment={c.id} label={c.name} />
      <FlashToast messages={SAVED_MESSAGES} />

      {/* Profile header */}
      <Card className="overflow-hidden py-0">
        <div className="h-20 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent sm:h-24" />
        <CardContent className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
            <Avatar className="-mt-10 size-20 border-4 border-card shadow-sm sm:-mt-12 sm:size-24">
              <AvatarFallback className="bg-primary text-2xl font-semibold text-primary-foreground">{initials(c.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 pb-1">
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">{c.name}</h1>
              {c.fatherOrHusbandName && <p className="truncate text-sm text-muted-foreground">Father / husband: {c.fatherOrHusbandName}</p>}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="font-mono">
                  {c.cnic}
                </Badge>
                {c.portal.enabled ? (
                  <Badge className="bg-success/10 text-success hover:bg-success/10">
                    <KeyRoundIcon /> Portal on
                  </Badge>
                ) : (
                  <Badge variant="secondary">Portal off</Badge>
                )}
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <CalendarIcon className="size-3" /> Customer since {formatDate(c.createdAt)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {c.phones[0] && (
              <Button variant="outline" asChild>
                <a href={`tel:${c.phones[0]}`}>
                  <PhoneIcon /> Call
                </a>
              </Button>
            )}
            {c.whatsapp && (
              <Button variant="outline" asChild>
                <a href={whatsappUrl(c.whatsapp)} target="_blank" rel="noopener noreferrer">
                  <WhatsAppIcon className="text-[#25D366]" /> WhatsApp
                </a>
              </Button>
            )}
            {canSeePlans && canCreatePlan && (
              <Button variant="outline" asChild>
                <Link href={`/plans/new?customerId=${c.id}`}>
                  <FilePlus2Icon /> New plan
                </Link>
              </Button>
            )}
            {canEdit && (
              <Button asChild>
                <Link href={`/customers/${c.id}/edit`}>
                  <PencilIcon /> Edit
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="gap-4">
        <TabsList className={RECORD_TABS}>
          <TabsTrigger value="overview">
            <UserIcon /> Overview
          </TabsTrigger>
          <TabsTrigger value="plans">
            <FileTextIcon /> Plans
            {plans.length > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5 tabular-nums">
                {plans.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="portal">
            <KeyRoundIcon /> Portal<span className="hidden sm:inline"> access</span>
          </TabsTrigger>
          {canSeeDocuments && (
            <TabsTrigger value="documents">
              <FolderLockIcon /> Documents
            </TabsTrigger>
          )}
          {canSeeHistory && (
            <TabsTrigger value="history">
              <HistoryIcon /> History
              <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5 tabular-nums">
                {history.length}
              </Badge>
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="overview" className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-base">Personal details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-5 sm:grid-cols-2">
                <Detail icon={IdCardIcon} label="CNIC" mono>
                  {c.cnic && (
                    <span className="inline-flex items-center gap-1">
                      {c.cnic} <CopyButton value={c.cnic} label="Copy CNIC" />
                    </span>
                  )}
                </Detail>
                <Detail icon={UserIcon} label="Father's / husband's name">
                  {c.fatherOrHusbandName}
                </Detail>
                <Detail icon={BriefcaseIcon} label="Profession / designation">
                  {[c.profession, c.designation].filter(Boolean).join(" · ")}
                </Detail>
                <Detail icon={UserIcon} label="Caste / tribe">
                  {c.caste}
                </Detail>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contact</CardTitle>
            </CardHeader>
            <CardContent>
              {c.whatsapp && (
                <a
                  href={whatsappUrl(c.whatsapp)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mb-3 flex items-center justify-between gap-2 rounded-lg border border-[#25D366]/30 bg-[#25D366]/5 px-3 py-2 transition-colors hover:bg-[#25D366]/10"
                >
                  <span className="flex items-center gap-2 font-mono text-sm">
                    <WhatsAppIcon className="size-3.5 text-[#25D366]" />
                    {formatPhone(c.whatsapp)}
                  </span>
                  <span className="text-xs font-medium text-[#128C7E] dark:text-[#25D366]">Chat on WhatsApp</span>
                </a>
              )}
              {c.phones.length ? (
                <ul className="space-y-2">
                  {c.phones.map((p, i) => (
                    <li key={p} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2">
                      <a href={`tel:${p}`} className="flex items-center gap-2 font-mono text-sm hover:text-primary">
                        <PhoneIcon className="size-3.5 text-muted-foreground" />
                        {formatPhone(p)}
                      </a>
                      {i === 0 && <Badge variant="secondary">Primary</Badge>}
                    </li>
                  ))}
                </ul>
              ) : (
                !c.whatsapp && <p className="text-sm text-muted-foreground">No phone number recorded.</p>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-base">Addresses</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-5 md:grid-cols-3">
                <Detail icon={HomeIcon} label="Home (permanent)">
                  {c.homeAddress}
                </Detail>
                <Detail icon={MapPinIcon} label="Installment collection">
                  {c.collectionAddress || (c.homeAddress && "Same as home address")}
                </Detail>
                <Detail icon={BriefcaseIcon} label="Business / office">
                  {c.businessAddress}
                </Detail>
              </dl>
              {c.notes && (
                <div className="mt-5 border-t pt-5">
                  <Detail icon={StickyNoteIcon} label="Notes">
                    {c.notes}
                  </Detail>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="plans" className="space-y-4">
          {cashBikes.length > 0 && (
            <Card className="gap-0 py-0">
              <CardHeader className="border-b py-3">
                <CardTitle className="text-sm">Bikes bought for cash</CardTitle>
              </CardHeader>
              <ul className="divide-y">
                {cashBikes.map((b) => (
                  <li key={b.id}>
                    <Link href={`/bikes/${b.id}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm hover:bg-muted/50">
                      <span className="min-w-0 truncate">
                        <span className="font-mono font-semibold">B-{b.bikeNumber}</span> · {b.label}
                      </span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {formatPKR(b.sale.price)} · {formatBusinessDate(b.sale.date)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {canSeePlans && plans.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                {plans.length} {plans.length === 1 ? "plan" : "plans"}
                {owed > 0 && (
                  <>
                    {" "}· still owes <span className="font-medium text-foreground tabular-nums">{formatPKR(owed)}</span>
                  </>
                )}
              </p>
              {canCreatePlan && (
                <Button size="sm" asChild>
                  <Link href={`/plans/new?customerId=${c.id}`}>
                    <FilePlus2Icon /> New plan
                  </Link>
                </Button>
              )}
            </div>
          )}
          {canSeePlans && plans.length > 0 ? (
            <div className="grid gap-3 md:grid-cols-2">
              {plans.map((p) => (
                <Link key={p.id} href={`/plans/${p.id}`} className="group rounded-xl border bg-card p-4 transition-shadow hover:shadow-md">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-semibold group-hover:underline">#{p.accountNumber}</p>
                      <p className="truncate font-medium">{p.item.description}</p>
                      <p className="text-xs text-muted-foreground">{formatBusinessDate(p.agreementDate)}</p>
                    </div>
                    <PlanStatusBadge status={p.status} overdue={p.overdue} />
                  </div>
                  <PlanProgress percent={p.percent} status={p.status} overdue={p.overdue} className="mt-4" />
                  <div className="mt-2 flex justify-between text-xs text-muted-foreground tabular-nums">
                    <span>Paid {formatPKR(p.cashReceived)} of {formatPKR(p.agreedTotal)}</span>
                    <span className="font-medium text-foreground">Balance {formatPKR(p.balance)}</span>
                  </div>
                </Link>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent>
                <Empty className="py-12">
                  <EmptyHeader>
                    <EmptyMedia variant="icon">
                      <ReceiptTextIcon />
                    </EmptyMedia>
                    <EmptyTitle>{canSeePlans ? "No plans yet" : "Plans are hidden"}</EmptyTitle>
                    <EmptyDescription>
                      {canSeePlans
                        ? `Installment plans for ${c.name} will be listed here.`
                        : "You need the “View plans” permission to see this customer's plans."}
                    </EmptyDescription>
                  </EmptyHeader>
                  {canSeePlans && canCreatePlan && (
                    <Button size="sm" asChild>
                      <Link href={`/plans/new?customerId=${c.id}`}>
                        <FilePlus2Icon /> New plan
                      </Link>
                    </Button>
                  )}
                </Empty>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="portal">
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle className="text-base">Customer portal login</CardTitle>
              <CardDescription>
                The customer signs in with their CNIC and this password to see their own plans and payments. Check their
                CNIC card before setting a password.
                {c.portal.lastLoginAt && ` Last sign-in: ${formatDateTime(c.portal.lastLoginAt)}.`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {canEdit ? (
                <PortalAccess
                  enabled={c.portal.enabled}
                  customerName={c.name}
                  setPasswordAction={setPortalPasswordAction.bind(null, c.id)}
                  disableAction={disablePortalAction.bind(null, c.id)}
                />
              ) : (
                <p className="text-sm text-muted-foreground">You need the “Edit customers” permission to change this.</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canSeeDocuments && (
          <TabsContent value="documents">
            <DocumentsSection actor={actor} ownerType="customer" ownerId={c.id} />
          </TabsContent>
        )}

        {canSeeHistory && (
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Change history</CardTitle>
                <CardDescription>Every change to this customer, newest first.</CardDescription>
              </CardHeader>
              <CardContent>
                <ActivityList events={history} showChanges emptyText="No changes recorded." />
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </PageBody>
  );
}
