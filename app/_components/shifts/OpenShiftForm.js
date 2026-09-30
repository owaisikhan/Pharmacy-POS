"use client";

import { openShift } from "@/app/_lib/actions";
import FormMessage from "@/app/_components/ui/FormMessage";
import SubmitButton from "@/app/_components/ui/SubmitButton";
import { useActionForm } from "@/app/_components/layout/ToastProvider";

export default function OpenShiftForm() {
  const [state, action] = useActionForm(openShift);
  return (
    <form action={action} className="flex flex-col gap-3">
      <div>
        <label htmlFor="opening_float" className="label">Cash in the drawer now (Rs)</label>
        <input id="opening_float" name="opening_float" inputMode="decimal" required autoFocus className="field text-right tabular-nums" placeholder="e.g. 5000" />
        <p className="hint">Count the notes and coins before the first sale. Enter 0 if the drawer is empty.</p>
      </div>
      <div>
        <label htmlFor="open-note" className="label">Note (optional)</label>
        <input id="open-note" name="note" className="field" placeholder="e.g. Morning shift, Bilal" />
      </div>
      {state && !state.ok ? <FormMessage state={state} /> : null}
      <SubmitButton pendingLabel="Opening...">Open shift</SubmitButton>
    </form>
  );
}
