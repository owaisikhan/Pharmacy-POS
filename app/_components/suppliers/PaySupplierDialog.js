"use client";

import { useState } from "react";
import { HandCoins } from "lucide-react";
import { paySupplier } from "@/app/_lib/actions";
import { formatRs } from "@/app/_lib/format-helpers";
import Dialog from "@/app/_components/ui/Dialog";
import FormMessage from "@/app/_components/ui/FormMessage";
import SubmitButton from "@/app/_components/ui/SubmitButton";
import { useActionForm } from "@/app/_components/layout/ToastProvider";

export default function PaySupplierDialog({ supplier }) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [state, action] = useActionForm(paySupplier, { onSuccess: () => { setOpen(false); setAmount(""); } });
  const balance = Number(supplier.balance);
  const after = balance - (Number(amount) || 0);
  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        <HandCoins className="h-4 w-4" aria-hidden /> Pay supplier
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Pay ${supplier.name}`} description={balance > 0 ? `You owe ${formatRs(balance)} now.` : "You owe nothing now."} size="sm">
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="supplier_id" value={supplier.id} />
          <div>
            <label htmlFor="sp-amount" className="label">Amount paid (Rs)</label>
            <input id="sp-amount" name="amount" inputMode="decimal" required autoFocus className="field text-right text-base tabular-nums" value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))} />
          </div>
          <div>
            <label htmlFor="sp-method" className="label">Paid by</label>
            <select id="sp-method" name="method" className="field" defaultValue="cash">
              <option value="cash">Cash (not from the counter drawer)</option>
              <option value="bank">Bank transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>
          <div>
            <label htmlFor="sp-note" className="label">Note (optional)</label>
            <input id="sp-note" name="note" className="field" placeholder="e.g. Cheque 004512" />
          </div>
          {Number(amount) > 0 ? (
            <p className="rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-sm font-medium">
              After this: {after > 0 ? `you still owe ${formatRs(after)}` : after < 0 ? `paid ahead ${formatRs(after)}` : "nothing owed"}.
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
