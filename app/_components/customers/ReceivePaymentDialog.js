"use client";

import { useState } from "react";
import { HandCoins } from "lucide-react";
import { receiveCustomerPayment } from "@/app/_lib/actions";
import { formatRs } from "@/app/_lib/format-helpers";
import Dialog from "@/app/_components/ui/Dialog";
import FormMessage from "@/app/_components/ui/FormMessage";
import SubmitButton from "@/app/_components/ui/SubmitButton";
import { useActionForm } from "@/app/_components/layout/ToastProvider";

export default function ReceivePaymentDialog({ customer }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [state, action] = useActionForm(receiveCustomerPayment, {
    onSuccess: () => {
      setOpen(false);
      setAmount("");
    },
  });
  const balance = Number(customer.balance);
  const after = balance - (Number(amount) || 0);
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <HandCoins className="h-4 w-4" aria-hidden /> Receive payment
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Payment from ${customer.name}`} description={balance > 0 ? `Owes ${formatRs(balance)} now.` : "Owes nothing now."} size="sm">
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="customer_id" value={customer.id} />
          <div>
            <label htmlFor="p-amount" className="label">Amount received (Rs)</label>
            <input id="p-amount" name="amount" inputMode="decimal" required autoFocus className="field text-right text-base tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
            {balance > 0 ? <button type="button" className="btn btn-ghost btn-sm mt-1" onClick={() => setAmount(String(balance))}>Full balance {formatRs(balance)}</button> : null}
          </div>
          <fieldset>
            <legend className="label">Paid by</legend>
            <div className="flex gap-4 text-sm">
              <label className="flex items-center gap-2"><input type="radio" name="method" value="cash" defaultChecked /> Cash (goes in the drawer)</label>
              <label className="flex items-center gap-2"><input type="radio" name="method" value="card" /> Card</label>
            </div>
          </fieldset>
          <div>
            <label htmlFor="p-note" className="label">Note (optional)</label>
            <input id="p-note" name="note" className="field" placeholder="e.g. September bills" />
          </div>
          {Number(amount) > 0 ? (
            <p className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium">
              After this: {after > 0 ? `still owes ${formatRs(after)}` : after < 0 ? `paid ahead ${formatRs(after)}` : "owes nothing"}.
            </p>
          ) : null}
          {state && !state.ok ? <FormMessage state={state} /> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <SubmitButton>Save payment</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
