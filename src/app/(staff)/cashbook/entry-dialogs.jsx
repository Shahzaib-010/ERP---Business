"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownLeftIcon, ArrowUpRightIcon, Ban, LandmarkIcon, PlusIcon, ReceiptTextIcon, UserMinusIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FormAlert } from "@/components/app/form-alert";
import { TextField, TextareaField } from "@/components/app/form-fields";
import { SubmitButton } from "@/components/submit-button";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/cashbook";
import { todayPk } from "@/lib/business-date";
import { cn } from "@/lib/utils";
import { MoneyField, SelectField } from "../plans/plan-fields";

const TYPES = [
  { value: "expense", label: "Expense", hint: "Rent, salaries, bills…", icon: ReceiptTextIcon, dir: "out" },
  { value: "other_income", label: "Other income", hint: "Commission, service…", icon: ArrowDownLeftIcon, dir: "in" },
  { value: "owner_investment", label: "Owner investment", hint: "Money put into the business", icon: LandmarkIcon, dir: "in" },
  { value: "owner_withdrawal", label: "Owner withdrawal", hint: "Money taken out by the owner", icon: UserMinusIcon, dir: "out" },
];

/**
 * `openWith` (from `?new=<type>`, used by the quick menu) opens the dialog on load with that
 * type chosen. Closing it removes the parameter so a reload does not reopen it; the page keys
 * this component on the parameter, so the next `?new=` link mounts it fresh.
 */
export function AddEntryDialog({ action, defaultType = "expense", openWith }) {
  const router = useRouter();
  const deepLinked = TYPES.some((t) => t.value === openWith);
  const [open, setOpen] = useState(deepLinked);
  const [round, setRound] = useState(0);
  const startType = deepLinked ? openWith : defaultType;
  const changeOpen = (o) => {
    setOpen(o);
    if (o) setRound((r) => r + 1);
    else if (deepLinked) {
      const url = new URL(window.location.href);
      url.searchParams.delete("new");
      router.replace(url.pathname + url.search, { scroll: false });
    }
  };
  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlusIcon /> Add entry
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add cash book entry</DialogTitle>
          <DialogDescription>Customer payments, seller payments and bike sales are added automatically. Use this for everything else.</DialogDescription>
        </DialogHeader>
        <EntryForm key={round} action={action} defaultType={startType} onDone={() => changeOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function EntryForm({ action, defaultType, onDone }) {
  const [state, formAction] = useActionState(action, null);
  const v = state?.values ?? {};
  const [type, setType] = useState(v.type ?? defaultType);
  const [amount, setAmount] = useState(v.amount ?? "");
  const errors = state?.fieldErrors ?? {};
  useEffect(() => {
    if (state?.ok) {
      toast.success("Entry added", {
        action: { label: "Print voucher", onClick: () => window.open(`/receipts/cashbook/${state.data.id}`, "_blank", "noopener") },
      });
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const categories = type === "expense" ? EXPENSE_CATEGORIES : type === "other_income" ? INCOME_CATEGORIES : null;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormAlert>{state && !state.ok && !Object.keys(errors).length ? state.error : null}</FormAlert>
      <input type="hidden" name="type" value={type} />
      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Type of entry">
        {TYPES.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={type === t.value}
            onClick={() => setType(t.value)}
            className={cn(
              "flex items-start gap-2.5 rounded-lg border p-3 text-left transition-colors",
              type === t.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/60",
            )}
          >
            <t.icon className={cn("mt-0.5 size-4 shrink-0", t.dir === "in" ? "text-success" : "text-warning-foreground dark:text-warning")} />
            <span>
              <span className="block text-sm font-medium">{t.label}</span>
              <span className="block text-xs text-muted-foreground">{t.hint}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField name="amount" label="Amount" required value={amount} onChange={setAmount} error={errors.amount} />
        <TextField name="occurredAt" type="date" label="Date" required defaultValue={v.occurredAt ?? todayPk()} max={todayPk()} error={errors.occurredAt} />
      </div>
      {categories && (
        <SelectField
          key={type}
          id="entry-category"
          name="category"
          label="Category"
          defaultValue={v.category && categories.some((c) => c.value === v.category) ? v.category : categories[0].value}
          options={categories}
          error={errors.category}
        />
      )}
      <TextField name="description" label="Description" required defaultValue={v.description ?? ""} placeholder="e.g. November shop rent" error={errors.description} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField name="party" label={TYPES.find((t) => t.value === type).dir === "out" ? "Paid to" : "Received from"} defaultValue={v.party ?? ""} error={errors.party} />
        <TextField name="voucherNumber" label="Voucher / bill no." defaultValue={v.voucherNumber ?? ""} error={errors.voucherNumber} inputClassName="font-mono" />
      </div>
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <SubmitButton icon={TYPES.find((t) => t.value === type).dir === "out" ? ArrowUpRightIcon : ArrowDownLeftIcon}>Save entry</SubmitButton>
      </DialogFooter>
    </form>
  );
}

export function VoidEntryButton({ action, label }) {
  const [open, setOpen] = useState(false);
  const [round, setRound] = useState(0);
  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setRound((r) => r + 1);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon-xs" aria-label={`Void ${label}`} className="text-muted-foreground hover:text-destructive">
          <Ban />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Void this entry?</DialogTitle>
          <DialogDescription>{label}. It is removed from the totals and kept in the history with your reason.</DialogDescription>
        </DialogHeader>
        <VoidForm key={round} action={action} onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}

function VoidForm({ action, onDone }) {
  const [state, formAction] = useActionState(action, null);
  useEffect(() => {
    if (state?.ok) {
      toast.success("Entry voided");
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const errors = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormAlert>{state && !state.ok && !Object.keys(errors).length ? state.error : null}</FormAlert>
      <TextareaField name="reason" label="Reason" rows={2} error={errors.reason} placeholder="e.g. Entered twice" />
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <SubmitButton icon={Ban} variant="destructive">
          Void entry
        </SubmitButton>
      </DialogFooter>
    </form>
  );
}
