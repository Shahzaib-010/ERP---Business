"use client";

import { useActionState, useEffect, useState } from "react";
import { BadgePercentIcon, Ban, CalendarCogIcon, MoreHorizontalIcon, PencilIcon, ReceiptIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Link from "next/link";
import { FormAlert } from "@/components/app/form-alert";
import { TextField, TextareaField } from "@/components/app/form-fields";
import { SubmitButton } from "@/components/submit-button";
import { FREQUENCY_LABELS } from "@/lib/installment-schedule";
import { dateOnlyString, todayPk } from "@/lib/business-date";
import { formatPKR } from "@/lib/format";
import { MoneyField, SelectField } from "../plan-fields";

/**
 * Runs a Server Action inside a dialog. Each time the dialog opens it gets a fresh form
 * (no errors left over from last time). On success: toast, close.
 */
function useDialogAction(action, { onSuccess } = {}) {
  const [state, formAction] = useActionState(action, null);
  useEffect(() => {
    if (state?.ok) onSuccess?.(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return [state, formAction];
}

function DialogShell({ trigger, title, description, open, setOpen, children, wide }) {
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className={wide ? "sm:max-w-lg" : "sm:max-w-md"}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}

// ---------- record payment ----------

export function RecordPaymentDialog({ action, balance, suggested, nextReceipt, minDate, trigger }) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  return (
    <DialogShell
      open={open}
      setOpen={(o) => {
        setOpen(o);
        if (o) setRound((r) => r + 1);
      }}
      trigger={trigger}
      title="Record payment"
      description={`Remaining balance ${formatPKR(balance)}. Any amount up to the balance is accepted.`}
    >
      <PaymentForm key={round} action={action} balance={balance} suggested={suggested} nextReceipt={nextReceipt} minDate={minDate} onDone={() => setOpen(false)} />
    </DialogShell>
  );
}

function PaymentForm({ action, balance, suggested, nextReceipt, minDate, onDone }) {
  const [state, formAction] = useDialogAction(action, {
    onSuccess: () => {
      toast.success("Payment recorded");
      onDone();
    },
  });
  const errors = state?.fieldErrors ?? {};
  const v = state?.values ?? {};
  const [amount, setAmount] = useState(v.amount ?? Math.min(suggested || balance, balance).toLocaleString("en-PK"));
  const quick = [...new Set([suggested, balance].filter((x) => x > 0 && x <= balance))];

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormAlert>{state && !state.ok && !Object.keys(errors).length ? state.error : null}</FormAlert>
      <MoneyField name="amount" label="Amount received" required value={amount} onChange={setAmount} error={errors.amount} />
      {quick.length > 0 && (
        <div className="-mt-2 flex flex-wrap gap-2">
          {quick.map((q) => (
            <Button key={q} type="button" variant="secondary" size="xs" onClick={() => setAmount(q.toLocaleString("en-PK"))}>
              {q === balance ? `Full balance ${formatPKR(q)}` : `Installment ${formatPKR(q)}`}
            </Button>
          ))}
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="paidAt" type="date" label="Date" required defaultValue={v.paidAt ?? todayPk()} min={minDate} max={todayPk()} error={errors.paidAt} />
        <TextField
          name="receiptNumber"
          label="Receipt no."
          inputMode="numeric"
          defaultValue={v.receiptNumber ?? String(nextReceipt)}
          error={errors.receiptNumber}
          hint="Clear it if there is no receipt."
          inputClassName="font-mono"
        />
      </div>
      <TextareaField name="note" label="Note" rows={2} defaultValue={v.note ?? ""} error={errors.note} />
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <SubmitButton icon={ReceiptIcon}>Save payment</SubmitButton>
      </DialogFooter>
    </form>
  );
}

// ---------- change schedule ----------

const FREQ_OPTIONS = Object.entries(FREQUENCY_LABELS).map(([value, label]) => ({ value, label }));

export function ScheduleDialog({ action, schedule, open, setOpen, round }) {
  return (
    <DialogShell
      wide
      open={open}
      setOpen={setOpen}
      title="Change payment schedule"
      description="For example a new due day. The original agreement stays on record unchanged."
    >
      <ScheduleForm key={round} action={action} schedule={schedule} onDone={() => setOpen(false)} />
    </DialogShell>
  );
}

function ScheduleForm({ action, schedule, onDone }) {
  const [state, formAction] = useDialogAction(action, {
    onSuccess: (s) => {
      toast.success(s.data?.changed === false ? "Nothing changed" : "Schedule updated");
      onDone();
    },
  });
  const errors = state?.fieldErrors ?? {};
  const v = state?.values ?? {};
  const [frequency, setFrequency] = useState(v.frequency ?? schedule.frequency);
  const [amount, setAmount] = useState(v.installmentAmount ?? (schedule.installmentAmount ? schedule.installmentAmount.toLocaleString("en-PK") : ""));

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormAlert>{state && !state.ok && !Object.keys(errors).length ? state.error : null}</FormAlert>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField id="sched-frequency" name="frequency" label="How often" value={frequency} onValueChange={setFrequency} options={FREQ_OPTIONS} error={errors.frequency} />
        {frequency === "monthly" && (
          <TextField name="dueDayOfMonth" label="Due by day of month" type="number" min={1} max={31} defaultValue={v.dueDayOfMonth ?? schedule.dueDayOfMonth ?? ""} error={errors.dueDayOfMonth} />
        )}
        {frequency === "custom" && (
          <TextField name="intervalDays" label="Every how many days" type="number" min={1} max={365} defaultValue={v.intervalDays ?? schedule.intervalDays ?? ""} error={errors.intervalDays} />
        )}
        <MoneyField id="sched-amount" name="installmentAmount" label="Installment amount" value={amount} onChange={setAmount} error={errors.installmentAmount} />
        <TextField
          name="firstDueDate"
          type="date"
          label="First installment due"
          defaultValue={v.firstDueDate ?? (schedule.firstDueDate ? dateOnlyString(schedule.firstDueDate) : "")}
          error={errors.firstDueDate}
        />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <SubmitButton icon={CalendarCogIcon}>Save schedule</SubmitButton>
      </DialogFooter>
    </form>
  );
}

// ---------- discount (Superadmin) ----------

export function DiscountDialog({ action, balance, open, setOpen, round }) {
  return (
    <DialogShell
      open={open}
      setOpen={setOpen}
      title={`Waive the remaining ${formatPKR(balance)}?`}
      description="This closes the plan. The discount is not cash received, and it is recorded in the history with your reason. Only the Superadmin can do this."
    >
      <DiscountForm key={round} action={action} balance={balance} onDone={() => setOpen(false)} />
    </DialogShell>
  );
}

function DiscountForm({ action, balance, onDone }) {
  const [state, formAction] = useDialogAction(action, {
    onSuccess: () => {
      toast.success("Plan closed with discount", { description: `${formatPKR(balance)} waived.` });
      onDone();
    },
  });
  const errors = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormAlert>{state && !state.ok && !Object.keys(errors).length ? state.error : null}</FormAlert>
      <TextField name="paidAt" type="date" label="Date" required defaultValue={todayPk()} max={todayPk()} error={errors.paidAt} />
      <TextareaField name="reason" label="Reason" rows={2} placeholder="e.g. Last 1,000 waived, good payment record" error={errors.reason} />
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <SubmitButton icon={BadgePercentIcon} variant="destructive">
          Waive {formatPKR(balance)}
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}

// ---------- void payment ----------

export function VoidPaymentButton({ action, label }) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  return (
    <DialogShell
      open={open}
      setOpen={(o) => {
        setOpen(o);
        if (o) setRound((r) => r + 1);
      }}
      trigger={
        <Button variant="ghost" size="icon-xs" aria-label={`Void ${label}`} className="text-muted-foreground hover:text-destructive">
          <Ban />
        </Button>
      }
      title={`Void ${label}?`}
      description="The payment stays in the history, crossed out, and stops counting towards the balance. Use this to correct a mistake."
    >
      <VoidForm key={round} action={action} onDone={() => setOpen(false)} />
    </DialogShell>
  );
}

function VoidForm({ action, onDone }) {
  const [state, formAction] = useDialogAction(action, {
    onSuccess: () => {
      toast.success("Payment voided");
      onDone();
    },
  });
  const errors = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormAlert>{state && !state.ok && !Object.keys(errors).length ? state.error : null}</FormAlert>
      <TextareaField name="reason" label="Reason" rows={2} placeholder="e.g. Wrong amount entered" error={errors.reason} />
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <SubmitButton icon={Ban} variant="destructive">
          Void payment
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}

// ---------- header actions ----------

/** "Record payment" plus a menu for the less common actions. Dialogs live outside the menu. */
export function PlanActions({ planId, active, balance, suggested, nextReceipt, minDate, schedule, can, actions }) {
  const [dialog, setDialog] = useState(null); // "schedule" | "discount" | null
  const [round, setRound] = useState(0);
  const openDialog = (name) => {
    setRound((r) => r + 1);
    setDialog(name);
  };
  const setOpen = (o) => !o && setDialog(null);
  const hasMenu = can.edit || (can.discount && active);

  return (
    <div className="flex flex-wrap gap-2">
      {active && can.pay && (
        <RecordPaymentDialog
          action={actions.pay}
          balance={balance}
          suggested={suggested}
          nextReceipt={nextReceipt}
          minDate={minDate}
          trigger={
            <Button>
              <ReceiptIcon /> Record payment
            </Button>
          }
        />
      )}
      {hasMenu && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="icon" aria-label="More actions">
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {can.edit && (
              <>
                <DropdownMenuItem onSelect={() => openDialog("schedule")}>
                  <CalendarCogIcon /> Change schedule
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href={`/plans/${planId}/edit`}>
                    <PencilIcon /> Edit item &amp; guarantors
                  </Link>
                </DropdownMenuItem>
              </>
            )}
            {can.discount && active && (
              <>
                {can.edit && <DropdownMenuSeparator />}
                <DropdownMenuItem variant="destructive" onSelect={() => openDialog("discount")}>
                  <BadgePercentIcon /> Close with discount
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {can.edit && <ScheduleDialog action={actions.schedule} schedule={schedule} open={dialog === "schedule"} setOpen={setOpen} round={round} />}
      {can.discount && active && <DiscountDialog action={actions.discount} balance={balance} open={dialog === "discount"} setOpen={setOpen} round={round} />}
    </div>
  );
}
