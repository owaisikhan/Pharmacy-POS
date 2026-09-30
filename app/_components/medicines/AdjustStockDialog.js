"use client";

import { useState } from "react";
import { adjustStock } from "@/app/_lib/actions";
import { formatUnits } from "@/app/_lib/format-helpers";
import Dialog from "@/app/_components/ui/Dialog";
import FormMessage from "@/app/_components/ui/FormMessage";
import SubmitButton from "@/app/_components/ui/SubmitButton";
import { useActionForm } from "@/app/_components/layout/ToastProvider";

const REASONS = [
  { value: "damaged", label: "Damaged or broken", remove: true },
  { value: "expired", label: "Expired, removed from shelf", remove: true },
  { value: "count", label: "Stock count correction" },
  { value: "other", label: "Other (write why)" },
];

// Say which way in words, then show the resulting stock before saving.
export default function AdjustStockDialog({ batch, medicine, defaultReason = "count", label = "Adjust" }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(defaultReason);
  const [direction, setDirection] = useState("remove");
  const [unit, setUnit] = useState(medicine.units_per_pack > 1 ? "pack" : "unit");
  const [qty, setQty] = useState("");
  const [state, action] = useActionForm(adjustStock, { onSuccess: () => setOpen(false) });

  const onlyRemove = REASONS.find((r) => r.value === reason)?.remove;
  const dir = onlyRemove ? "remove" : direction;
  const units = (Number(qty) || 0) * (unit === "pack" ? medicine.units_per_pack : 1);
  const after = batch.qty_on_hand + (dir === "add" ? units : -units);

  return (
    <>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>{label}</button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`${label}: batch ${batch.batch_no}`} description={`${medicine.name} ${medicine.strength}. In stock now: ${formatUnits(batch.qty_on_hand, medicine.units_per_pack)}.`} size="sm">
        <form action={action} className="flex flex-col gap-3">
          <input type="hidden" name="batch_id" value={batch.id} />
          <input type="hidden" name="per_pack" value={medicine.units_per_pack} />
          <input type="hidden" name="direction" value={dir} />
          <div>
            <label htmlFor="reason" className="label">Reason</label>
            <select id="reason" name="reason" className="field" value={reason} onChange={(e) => setReason(e.target.value)}>
              {REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {!onlyRemove ? (
            <div role="radiogroup" aria-label="Direction" className="grid grid-cols-2 gap-2">
              {[["remove", "Remove units"], ["add", "Add units"]].map(([v, l]) => (
                <button key={v} type="button" role="radio" aria-checked={direction === v} onClick={() => setDirection(v)} className={`btn ${direction === v ? "btn-primary" : "btn-secondary"}`}>{l}</button>
              ))}
            </div>
          ) : null}
          <div className="flex gap-2">
            <div className="flex-1">
              <label htmlFor="adj-qty" className="label">Quantity</label>
              <input id="adj-qty" name="qty" inputMode="numeric" required className="field text-right tabular-nums" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} autoFocus />
            </div>
            {medicine.units_per_pack > 1 ? (
              <div className="w-32">
                <label htmlFor="adj-unit" className="label">In</label>
                <select id="adj-unit" name="unit" className="field" value={unit} onChange={(e) => setUnit(e.target.value)}>
                  <option value="pack">Packs</option>
                  <option value="unit">Loose units</option>
                </select>
              </div>
            ) : <input type="hidden" name="unit" value="unit" />}
          </div>
          <div>
            <label htmlFor="adj-note" className="label">Note {reason === "other" ? "" : "(optional)"}</label>
            <input id="adj-note" name="note" className="field" required={reason === "other"} placeholder="e.g. Strip torn while unpacking" />
          </div>
          {units > 0 ? (
            <p className={`rounded-lg px-3 py-2 text-sm font-medium ${after < 0 ? "bg-[var(--color-danger-soft)] text-[var(--color-danger)]" : "bg-[var(--color-surface-2)]"}`}>
              {after < 0
                ? `Only ${formatUnits(batch.qty_on_hand, medicine.units_per_pack)} in this batch.`
                : `${dir === "add" ? "Adds" : "Removes"} ${formatUnits(units, medicine.units_per_pack)}. Stock after: ${formatUnits(after, medicine.units_per_pack)}.`}
            </p>
          ) : null}
          {state && !state.ok ? <FormMessage state={state} /> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <SubmitButton pendingLabel="Saving..." className={dir === "remove" ? "btn-danger" : "btn-primary"} disabled={after < 0 || units === 0}>
              {dir === "remove" ? "Remove stock" : "Add stock"}
            </SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
