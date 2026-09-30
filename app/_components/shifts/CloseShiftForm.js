"use client";

import { useState } from "react";
import { closeShift } from "@/app/_lib/actions";
import { formatRs } from "@/app/_lib/format-helpers";
import FormMessage from "@/app/_components/ui/FormMessage";
import SubmitButton from "@/app/_components/ui/SubmitButton";
import Dialog from "@/app/_components/ui/Dialog";
import { useActionForm } from "@/app/_components/layout/ToastProvider";

// Close the drawer: count the cash, see the difference before saving.
export default function CloseShiftForm({ expected }) {
  const [open, setOpen] = useState(false);
  const [counted, setCounted] = useState("");
  const [state, action] = useActionForm(closeShift, { onSuccess: () => setOpen(false) });
  const n = Number(counted);
  const diff = counted === "" || !Number.isFinite(n) ? null : Math.round((n - expected) * 100) / 100;

  return (
    <>
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        Close shift
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Close shift" description="Count every note and coin in the drawer." size="sm">
        <form action={action} className="flex flex-col gap-3">
          <div className="flex justify-between rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-sm">
            <span>Cash that should be in the drawer</span>
            <span className="num font-semibold">{formatRs(expected)}</span>
          </div>
          <div>
            <label htmlFor="counted_cash" className="label">Cash you counted (Rs)</label>
            <input id="counted_cash" name="counted_cash" inputMode="decimal" required autoFocus className="field text-right text-base tabular-nums" value={counted} onChange={(e) => setCounted(e.target.value.replace(/[^\d.]/g, ""))} />
          </div>
          {diff !== null ? (
            <p className={`rounded-lg px-3 py-2 text-sm font-semibold ${diff === 0 ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]" : "bg-[var(--color-warning-soft)] text-[var(--color-warning)]"}`}>
              {diff === 0 ? "The drawer matches exactly." : `The drawer is ${formatRs(diff)} ${diff > 0 ? "over" : "short"}.`}
            </p>
          ) : null}
          <div>
            <label htmlFor="close-note" className="label">Note (optional)</label>
            <input id="close-note" name="note" className="field" placeholder="e.g. Rs 100 short, customer change error" />
          </div>
          {state && !state.ok ? <FormMessage state={state} /> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <SubmitButton pendingLabel="Closing...">Close shift</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
