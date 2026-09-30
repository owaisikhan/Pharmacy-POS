"use client";

import { useState } from "react";
import { Scale } from "lucide-react";
import Dialog from "@/app/_components/ui/Dialog";
import FormMessage from "@/app/_components/ui/FormMessage";
import SubmitButton from "@/app/_components/ui/SubmitButton";
import { useActionForm } from "@/app/_components/layout/ToastProvider";

// Opening balance or correction on a customer or supplier account. The
// direction is said in words; nothing is typed as a minus sign.
export default function BalanceEntryDialog({ action: serverAction, idName, id, name, directions }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionForm(serverAction, { onSuccess: () => setOpen(false) });
  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        <Scale className="h-4 w-4" aria-hidden /> Balance entry
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Balance entry: ${name}`} description="For an opening balance brought from the old register, or a correction." size="sm">
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name={idName} value={id} />
          <div>
            <label htmlFor="b-kind" className="label">Kind</label>
            <select id="b-kind" name="kind" className="field" defaultValue="opening">
              <option value="opening">Opening balance</option>
              <option value="adjustment">Correction</option>
            </select>
          </div>
          <fieldset>
            <legend className="label">Direction</legend>
            <div className="flex flex-col gap-1 text-sm">
              {directions.map((d, i) => (
                <label key={d.value} className="flex items-center gap-2">
                  <input type="radio" name="direction" value={d.value} defaultChecked={i === 0} /> {d.label}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="b-amount" className="label">Amount (Rs)</label>
            <input id="b-amount" name="amount" inputMode="decimal" required className="field text-right tabular-nums" />
          </div>
          <div>
            <label htmlFor="b-note" className="label">Why</label>
            <input id="b-note" name="note" required className="field" placeholder="e.g. Balance from paper register, 30 Sep 2026" />
          </div>
          {state && !state.ok ? <FormMessage state={state} /> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <SubmitButton>Save entry</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
