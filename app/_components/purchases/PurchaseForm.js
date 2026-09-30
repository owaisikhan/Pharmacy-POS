"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { createPurchase } from "@/app/_lib/actions";
import { formatRs, round2 } from "@/app/_lib/format-helpers";
import { monthToExpiry, todayPK } from "@/app/_lib/date-helpers";
import FormMessage from "@/app/_components/ui/FormMessage";
import Spinner from "@/app/_components/ui/Spinner";
import { useToast } from "@/app/_components/layout/ToastProvider";

const blankLine = () => ({ key: crypto.randomUUID(), medicineId: "", search: "", batchNo: "", expiryMonth: "", packs: "", bonusPacks: "", costPerPack: "", salePricePerPack: "" });

// A supplier's invoice, line by line: batch, expiry, packs, bonus packs, cost
// and the sale price to use from now on. The database checks every line again.
export default function PurchaseForm({ suppliers, medicines }) {
  const router = useRouter();
  const toast = useToast();
  const [supplierId, setSupplierId] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [purchaseDate, setPurchaseDate] = useState(todayPK());
  const [lines, setLines] = useState([blankLine()]);
  const [discount, setDiscount] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [paidMethod, setPaidMethod] = useState("cash");
  const [note, setNote] = useState("");
  const [state, setState] = useState(null);
  const [isPending, startTransition] = useTransition();
  const submitted = useRef(false);

  const byLabel = useMemo(() => {
    const map = new Map();
    for (const m of medicines) map.set(`${m.name} ${m.strength} (${m.form})`.replace(/\s+/g, " ").trim(), m);
    return map;
  }, [medicines]);
  const byId = useMemo(() => new Map(medicines.map((m) => [String(m.id), m])), [medicines]);

  const subtotal = round2(lines.reduce((s, l) => s + (Number(l.packs) || 0) * (Number(l.costPerPack) || 0), 0));
  const total = round2(subtotal - Math.min(subtotal, Number(discount) || 0));

  function update(key, changes) {
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...changes } : l)));
  }

  function pickMedicine(key, text) {
    const m = byLabel.get(text.replace(/\s+/g, " ").trim());
    update(key, { search: text, medicineId: m ? String(m.id) : "", ...(m && Number(m.sale_price_per_pack) > 0 ? { salePricePerPack: String(m.sale_price_per_pack) } : {}) });
  }

  function submit(e) {
    e.preventDefault();
    if (submitted.current) return;
    const bad = lines.findIndex((l) => !l.medicineId);
    if (!supplierId) return setState({ ok: false, message: "Choose the supplier." });
    if (bad >= 0) return setState({ ok: false, message: `Line ${bad + 1}: choose a medicine from the list (add it on the Medicines page if it is new).` });
    startTransition(async () => {
      submitted.current = true;
      const result = await createPurchase({
        supplierId: Number(supplierId),
        invoiceNo,
        purchaseDate,
        discount,
        paidAmount,
        paidMethod,
        note,
        lines: lines.map((l) => ({
          medicineId: Number(l.medicineId),
          batchNo: l.batchNo,
          expiryDate: monthToExpiry(l.expiryMonth),
          packs: l.packs,
          bonusPacks: l.bonusPacks,
          costPerPack: l.costPerPack,
          salePricePerPack: l.salePricePerPack,
        })),
      });
      setState(result);
      if (result.ok) {
        toast(result);
        router.push(`/purchases/${result.purchaseId}`);
      } else {
        submitted.current = false;
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="supplier" className="label">Supplier</label>
          <select id="supplier" className="field" required value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>
            <option value="">Choose...</option>
            {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          {suppliers.length === 0 ? <p className="hint">Add a supplier first on the <Link href="/suppliers" className="underline">Suppliers</Link> page.</p> : null}
        </div>
        <div>
          <label htmlFor="invoice" className="label">Supplier&apos;s invoice number</label>
          <input id="invoice" className="field" value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="e.g. MP-20931" />
        </div>
        <div>
          <label htmlFor="pdate" className="label">Invoice date</label>
          <input id="pdate" type="date" className="field" max={todayPK()} value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
        </div>
      </div>

      <datalist id="medicine-options">
        {[...byLabel.keys()].map((label) => <option key={label} value={label} />)}
      </datalist>

      <div className="table-wrap">
        <table className="table min-w-[72rem]">
          <caption className="sr-only">Invoice lines</caption>
          <thead>
            <tr>
              <th scope="col">Medicine</th>
              <th scope="col">Batch no.</th>
              <th scope="col">Expiry (month)</th>
              <th scope="col" className="text-right">Packs</th>
              <th scope="col" className="text-right">Bonus</th>
              <th scope="col" className="text-right">Cost / pack</th>
              <th scope="col" className="text-right">Sale price / pack</th>
              <th scope="col" className="text-right">Amount</th>
              <th scope="col"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => {
              const m = byId.get(l.medicineId);
              const amount = round2((Number(l.packs) || 0) * (Number(l.costPerPack) || 0));
              const lowPrice = Number(l.salePricePerPack) > 0 && Number(l.salePricePerPack) < Number(l.costPerPack);
              return (
                <tr key={l.key}>
                  <td>
                    <input aria-label={`Line ${i + 1} medicine`} list="medicine-options" className="field min-w-[16rem]" value={l.search} onChange={(e) => pickMedicine(l.key, e.target.value)} placeholder="Type to choose" aria-invalid={l.search && !m ? true : undefined} />
                    {m ? <p className="hint">{m.units_per_pack > 1 ? `${m.units_per_pack} per pack` : "Sold each"}</p> : l.search ? <p className="hint text-[var(--color-danger)]">Choose from the list</p> : null}
                  </td>
                  <td><input aria-label={`Line ${i + 1} batch number`} className="field w-28 font-mono uppercase" value={l.batchNo} onChange={(e) => update(l.key, { batchNo: e.target.value })} required /></td>
                  <td><input aria-label={`Line ${i + 1} expiry month`} type="month" className="field w-40" min={todayPK().slice(0, 7)} value={l.expiryMonth} onChange={(e) => update(l.key, { expiryMonth: e.target.value })} required /></td>
                  <td><input aria-label={`Line ${i + 1} packs`} inputMode="numeric" className="field w-20 text-right tabular-nums" value={l.packs} onChange={(e) => update(l.key, { packs: e.target.value.replace(/\D/g, "") })} required /></td>
                  <td><input aria-label={`Line ${i + 1} bonus packs`} inputMode="numeric" className="field w-16 text-right tabular-nums" value={l.bonusPacks} onChange={(e) => update(l.key, { bonusPacks: e.target.value.replace(/\D/g, "") })} placeholder="0" /></td>
                  <td><input aria-label={`Line ${i + 1} cost per pack`} inputMode="decimal" className="field w-24 text-right tabular-nums" value={l.costPerPack} onChange={(e) => update(l.key, { costPerPack: e.target.value.replace(/[^\d.]/g, "") })} required /></td>
                  <td>
                    <input aria-label={`Line ${i + 1} sale price per pack`} inputMode="decimal" className="field w-24 text-right tabular-nums" value={l.salePricePerPack} onChange={(e) => update(l.key, { salePricePerPack: e.target.value.replace(/[^\d.]/g, "") })} aria-invalid={lowPrice || undefined} />
                    {lowPrice ? <p className="hint text-[var(--color-danger)]">Below cost</p> : null}
                  </td>
                  <td className="num font-semibold">{formatRs(amount)}</td>
                  <td>
                    <button type="button" className="btn btn-ghost btn-sm px-1.5 text-[var(--color-danger)]" aria-label={`Remove line ${i + 1}`} disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setLines((ls) => [...ls, blankLine()])}>
          <Plus className="h-4 w-4" aria-hidden /> Add line
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-4">
          <div>
            <label htmlFor="pnote" className="label">Note (optional)</label>
            <input id="pnote" className="field" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Delivered by Asif, two cartons" />
          </div>
          <p className="text-sm text-[var(--color-muted)]">
            Bonus packs are free, so they lower the cost of every unit in the batch. The sale price you enter becomes the medicine&apos;s price on the sale screen.
          </p>
        </div>
        <div className="card flex flex-col gap-3 p-4">
          <div className="flex justify-between text-sm"><span className="text-[var(--color-muted)]">Invoice amount</span><span className="num">{formatRs(subtotal)}</span></div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <label htmlFor="pdisc" className="text-[var(--color-muted)]">Invoice discount (Rs)</label>
            <input id="pdisc" inputMode="decimal" className="field w-28 text-right tabular-nums" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" />
          </div>
          <div className="flex items-baseline justify-between border-t border-[var(--color-border)] pt-3">
            <span className="font-semibold">Total</span><span className="num text-2xl font-bold">{formatRs(total)}</span>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <label htmlFor="ppaid" className="font-medium">Paid now (Rs)</label>
            <input id="ppaid" inputMode="decimal" className="field w-28 text-right tabular-nums" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value.replace(/[^\d.]/g, ""))} placeholder="0" />
          </div>
          {Number(paidAmount) > 0 ? (
            <select aria-label="Paid by" className="field" value={paidMethod} onChange={(e) => setPaidMethod(e.target.value)}>
              <option value="cash">Cash</option>
              <option value="bank">Bank transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          ) : null}
          <p className="text-sm text-[var(--color-muted)]">
            {total - (Number(paidAmount) || 0) > 0 ? `${formatRs(total - (Number(paidAmount) || 0))} goes on the supplier's account.` : "Paid in full."}
          </p>
          {state && !state.ok ? <FormMessage state={state} /> : null}
          <button type="submit" className="btn btn-primary" disabled={isPending}>
            {isPending ? (<><Spinner /> Saving...</>) : "Save purchase and add stock"}
          </button>
        </div>
      </div>
    </form>
  );
}
