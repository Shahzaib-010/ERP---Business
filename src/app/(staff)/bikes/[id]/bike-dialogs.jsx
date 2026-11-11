"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { Ban, BanknoteIcon, FileTextIcon, HandCoinsIcon, MoreHorizontalIcon, PencilIcon, ShoppingBagIcon, Undo2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { FormAlert } from "@/components/app/form-alert";
import { TextField, TextareaField } from "@/components/app/form-fields";
import { SubmitButton } from "@/components/submit-button";
import { todayPk } from "@/lib/business-date";
import { formatPKR } from "@/lib/format";
import { CustomerPicker } from "../../plans/customer-picker";
import { MoneyField } from "../../plans/plan-fields";

/** A fresh form each time the dialog opens; toast + close on success. */
function ActionForm({ action, success, onDone, children }) {
  const [state, formAction] = useActionState(action, null);
  useEffect(() => {
    if (state?.ok) {
      toast.success(typeof success === "function" ? success(state) : success);
      onDone();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  const errors = state?.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormAlert>{state && !state.ok && !Object.keys(errors).length ? state.error : null}</FormAlert>
      {children({ errors, values: state?.values ?? {} })}
    </form>
  );
}

function Footer({ icon, label, destructive }) {
  return (
    <DialogFooter>
      <DialogClose asChild>
        <Button type="button" variant="outline">
          Cancel
        </Button>
      </DialogClose>
      <SubmitButton icon={icon} variant={destructive ? "destructive" : "default"}>
        {label}
      </SubmitButton>
    </DialogFooter>
  );
}

function useRounds() {
  const [open, setOpen] = useState(null);
  const [round, setRound] = useState(0);
  return {
    open,
    round,
    show: (name) => {
      setRound((r) => r + 1);
      setOpen(name);
    },
    hide: () => setOpen(null),
  };
}

export function BikeActions({ bikeId, inStock, payable, purchaseDate, nextReceipt, saleMode, can, actions }) {
  const d = useRounds();
  const hasMenu = can.edit || (saleMode === "cash" && can.cancel);

  return (
    <div className="flex flex-wrap gap-2">
      {inStock && can.sell && (
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button>
              <ShoppingBagIcon /> Sell bike
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuItem onSelect={() => d.show("cash")} className="items-start gap-3 py-2">
              <BanknoteIcon className="mt-0.5" />
              <span>
                <span className="block font-medium">Sell for cash</span>
                <span className="block text-xs text-muted-foreground">Paid in full now</span>
              </span>
            </DropdownMenuItem>
            {can.plan && (
              <DropdownMenuItem asChild className="items-start gap-3 py-2">
                <Link href={`/plans/new?bikeId=${bikeId}`}>
                  <FileTextIcon className="mt-0.5" />
                  <span>
                    <span className="block font-medium">Sell on installments</span>
                    <span className="block text-xs text-muted-foreground">Opens a new installment plan</span>
                  </span>
                </Link>
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {payable > 0 && can.paySeller && (
        <Button variant="outline" onClick={() => d.show("pay")}>
          <HandCoinsIcon /> Pay seller
        </Button>
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
              <DropdownMenuItem asChild>
                <Link href={`/bikes/${bikeId}/edit`}>
                  <PencilIcon /> Edit details
                </Link>
              </DropdownMenuItem>
            )}
            {saleMode === "cash" && can.cancel && (
              <>
                {can.edit && <DropdownMenuSeparator />}
                <DropdownMenuItem variant="destructive" onSelect={() => d.show("cancel")}>
                  <Undo2Icon /> Cancel cash sale
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Dialog open={d.open === "pay"} onOpenChange={(o) => !o && d.hide()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Pay the seller</DialogTitle>
            <DialogDescription>Still owed: {formatPKR(payable)}.</DialogDescription>
          </DialogHeader>
          <ActionForm key={`pay-${d.round}`} action={actions.pay} success="Seller payment recorded" onDone={d.hide}>
            {({ errors, values }) => (
              <PaySellerFields errors={errors} values={values} payable={payable} purchaseDate={purchaseDate} />
            )}
          </ActionForm>
        </DialogContent>
      </Dialog>

      <Dialog open={d.open === "cash"} onOpenChange={(o) => !o && d.hide()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sell for cash</DialogTitle>
            <DialogDescription>The customer pays the full price now. To sell on installments, use “Sell on installments” instead.</DialogDescription>
          </DialogHeader>
          <ActionForm key={`cash-${d.round}`} action={actions.sell} success="Bike sold" onDone={d.hide}>
            {({ errors, values }) => <CashSaleFields errors={errors} values={values} purchaseDate={purchaseDate} nextReceipt={nextReceipt} />}
          </ActionForm>
        </DialogContent>
      </Dialog>

      <Dialog open={d.open === "cancel"} onOpenChange={(o) => !o && d.hide()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel this cash sale?</DialogTitle>
            <DialogDescription>Use this only if the sale was entered by mistake. The bike goes back into stock; the sale stays in the history.</DialogDescription>
          </DialogHeader>
          <ActionForm key={`cancel-${d.round}`} action={actions.cancel} success="Sale cancelled; bike is back in stock" onDone={d.hide}>
            {({ errors }) => (
              <>
                <TextareaField name="reason" label="Reason" rows={2} error={errors.reason} placeholder="e.g. Wrong bike selected" />
                <Footer icon={Undo2Icon} label="Cancel sale" destructive />
              </>
            )}
          </ActionForm>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaySellerFields({ errors, values, payable, purchaseDate }) {
  const [amount, setAmount] = useState(values.amount ?? payable.toLocaleString("en-PK"));
  return (
    <>
      <MoneyField name="amount" label="Amount paid" required value={amount} onChange={setAmount} error={errors.amount} />
      <TextField name="paidAt" type="date" label="Date" required defaultValue={values.paidAt ?? todayPk()} min={purchaseDate} max={todayPk()} error={errors.paidAt} />
      <TextareaField name="note" label="Note" rows={2} defaultValue={values.note ?? ""} error={errors.note} />
      <Footer icon={HandCoinsIcon} label="Save payment" />
    </>
  );
}

function CashSaleFields({ errors, values, purchaseDate, nextReceipt }) {
  const [price, setPrice] = useState(values.salePrice ?? "");
  return (
    <>
      <Field data-invalid={errors.customerId ? true : undefined}>
        <FieldLabel htmlFor="customerId">
          Customer <span className="text-destructive">*</span>
        </FieldLabel>
        <CustomerPicker invalid={Boolean(errors.customerId)} />
        {errors.customerId && <FieldError>{errors.customerId}</FieldError>}
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <MoneyField name="salePrice" label="Sale price" required value={price} onChange={setPrice} error={errors.salePrice} />
        <TextField name="saleDate" type="date" label="Sale date" required defaultValue={values.saleDate ?? todayPk()} min={purchaseDate} max={todayPk()} error={errors.saleDate} />
      </div>
      <TextField
        name="receiptNumber"
        label="Receipt no."
        inputMode="numeric"
        defaultValue={values.receiptNumber ?? String(nextReceipt)}
        error={errors.receiptNumber}
        hint="Clear it if there is no receipt."
        inputClassName="font-mono"
      />
      <TextareaField name="note" label="Note" rows={2} defaultValue={values.note ?? ""} error={errors.note} />
      <Footer icon={BanknoteIcon} label="Record sale" />
    </>
  );
}

export function VoidSellerPaymentButton({ action, label }) {
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
          <DialogTitle>Void {label}?</DialogTitle>
          <DialogDescription>It stays in the history, crossed out, and the amount goes back to “owed to seller”.</DialogDescription>
        </DialogHeader>
        <ActionForm key={round} action={action} success="Payment voided" onDone={() => setOpen(false)}>
          {({ errors }) => (
            <>
              <TextareaField name="reason" label="Reason" rows={2} error={errors.reason} placeholder="e.g. Entered twice" />
              <Footer icon={Ban} label="Void payment" destructive />
            </>
          )}
        </ActionForm>
      </DialogContent>
    </Dialog>
  );
}
