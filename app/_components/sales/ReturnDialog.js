"use client";

import { useState, useTransition } from "react";
import { Undo2 } from "lucide-react";
import { createReturn } from "@/app/_lib/actions";
import { formatRs, formatUnits, round2 } from "@/app/_lib/format-helpers";
import Dialog from "@/app/_components/ui/Dialog";
import FormMessage from "@/app/_components/ui/FormMessage";
import Spinner from "@/app/_components/ui/Spinner";
import { useToast } from "@/app/_components/layout/ToastProvider";

// Return part or all of a bill. Quantities are entered in packs and loose
// units; the refund preview uses the same share-of-the-bill rule as the
// database, which has the final word.
export default function ReturnDialog({ sale }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [qty, setQty] = useState({});
  const [method, setMethod] = useState(Number(sale.credit_amount) > 0 && sale.customer ? "account" : "cash");
  const [note, setNote] = useState("");
  const [state, setState] = useState(null);
  const [ref, setRef] = useState(() => crypto.randomUUID());
  const [isPending, startTransition] = useTransition();

  const linesTotal = sale.sale_lines.reduce((s, l) => s + Number(l.line_total), 0);
  const factor = linesTotal > 0 ? Number(sale.total) / linesTotal : 0;

  const lines = sale.sale_lines.map((l) => {
    const returnable = l.sale_line_batches.reduce((s, b) => s + b.qty_units - b.qty_returned, 0);
    const per = l.medicine.units_per_pack;
    const q = qty[l.id] || { packs: "", loose: "" };
    const units = (Number(q.packs) || 0) * per + (Number(q.loose) || 0);
    const amount = units > 0 ? round2((Number(l.line_total) * units) / l.qty_units * factor) : 0;
    return { ...l, returnable, per, q, units, amount, tooMany: units > returnable };
  });
  const refund = round2(lines.reduce((s, l) => s + l.amount, 0));
  const anyReturnable = lines.some((l) => l.returnable > 0);
  const invalid = lines.some((l) => l.tooMany) || lines.every((l) => l.units === 0);

  const setLine = (id, key, value) => setQty((m) => ({ ...m, [id]: { ...(m[id] || { packs: "", loose: "" }), [key]: value.replace(/\D/g, "") } }));

  const returnAll = () =>
    setQty(Object.fromEntries(lines.map((l) => [l.id, { packs: String(Math.floor(l.returnable / l.per) || ""), loose: String(l.returnable % l.per || "") }])));

  function submit(e) {
    e.preventDefault();
    if (invalid) return;
    startTransition(async () => {
      const result = await createReturn({
        clientRef: ref,
        saleId: sale.id,
        refundMethod: method,
        note,
        lines: lines.filter((l) => l.units > 0).map((l) => ({ saleLineId: l.id, qtyUnits: l.units })),
      });
      setState(result);
      if (result.ok) {
        toast(result);
        setOpen(false);
        setQty({});
        setNote("");
        setState(null);
        setRef(crypto.randomUUID());
      }
    });
  }

  if (!anyReturnable) return null;

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        <Undo2 className="h-4 w-4" aria-hidden /> Return items
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={`Return from ${sale.invoice_no}`} description="Returned stock goes back to the batch it was sold from." size="lg">
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div className="table-wrap">
            <table className="table min-w-[40rem]">
              <caption className="sr-only">Items that can be returned</caption>
              <thead>
                <tr>
                  <th scope="col">Medicine</th>
                  <th scope="col" className="text-right">Can return</th>
                  <th scope="col" className="text-right">Packs</th>
                  <th scope="col" className="text-right">Loose</th>
                  <th scope="col" className="text-right">Refund</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <p className="font-semibold">{l.medicine.name} {l.medicine.strength}</p>
                      {l.tooMany ? <p className="text-xs font-semibold text-[var(--color-danger)]">More than can be returned</p> : null}
                    </td>
                    <td className="num">{formatUnits(l.returnable, l.per)}</td>
                    <td className="text-right">
                      <input aria-label={`Packs of ${l.medicine.name} to return`} inputMode="numeric" disabled={l.returnable === 0} className="field ml-auto w-16 text-right tabular-nums" value={l.q.packs} onChange={(e) => setLine(l.id, "packs", e.target.value)} aria-invalid={l.tooMany || undefined} />
                    </td>
                    <td className="text-right">
                      {l.per > 1 ? (
                        <input aria-label={`Loose units of ${l.medicine.name} to return`} inputMode="numeric" disabled={l.returnable === 0} className="field ml-auto w-16 text-right tabular-nums" value={l.q.loose} onChange={(e) => setLine(l.id, "loose", e.target.value)} aria-invalid={l.tooMany || undefined} />
                      ) : (
                        <span className="text-xs text-[var(--color-muted)]">n/a</span>
                      )}
                    </td>
                    <td className="num">{formatRs(l.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="btn btn-ghost btn-sm" onClick={returnAll}>Return everything left</button>
            <p className="text-sm">
              Refund <span className="num text-lg font-bold">{formatRs(refund)}</span>
            </p>
          </div>
          <fieldset>
            <legend className="label">Give the refund</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="radio" name="method" value="cash" checked={method === "cash"} onChange={() => setMethod("cash")} /> In cash from the drawer
              </label>
              <label className={`flex items-center gap-2 ${sale.customer ? "" : "opacity-50"}`}>
                <input type="radio" name="method" value="account" disabled={!sale.customer} checked={method === "account"} onChange={() => setMethod("account")} />
                {sale.customer ? `To ${sale.customer.name}'s account` : "To an account (bill has no customer)"}
              </label>
            </div>
          </fieldset>
          <div>
            <label htmlFor="return-note" className="label">Reason (optional)</label>
            <input id="return-note" className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Doctor changed the prescription" />
          </div>
          <FormMessage state={state && !state.ok ? state : null} />
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={invalid || isPending}>
              {isPending ? (<><Spinner /> Saving...</>) : `Refund ${formatRs(refund)}`}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
