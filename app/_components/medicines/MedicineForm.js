"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { saveMedicine } from "@/app/_lib/actions";
import { siteConfig } from "@/app/_lib/siteConfig";
import { formatRs, unitPrice } from "@/app/_lib/format-helpers";
import FormMessage from "@/app/_components/ui/FormMessage";
import SubmitButton from "@/app/_components/ui/SubmitButton";
import { useActionForm } from "@/app/_components/layout/ToastProvider";

export default function MedicineForm({ medicine, categories = [], companies = [] }) {
  const router = useRouter();
  const [perPack, setPerPack] = useState(medicine?.units_per_pack ?? 10);
  const [price, setPrice] = useState(medicine?.sale_price_per_pack ?? "");
  const [state, action] = useActionForm(saveMedicine, {
    onSuccess: (s) => {
      if (!medicine) router.push(`/medicines/${s.id}`);
    },
  });
  const per = Math.max(1, Number(perPack) || 1);

  return (
    <form action={action} className="flex flex-col gap-5">
      {medicine ? <input type="hidden" name="id" value={medicine.id} /> : null}
      <fieldset className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <legend className="sr-only">Medicine</legend>
        <div className="sm:col-span-2 lg:col-span-1">
          <label htmlFor="name" className="label">Brand name</label>
          <input id="name" name="name" required className="field" defaultValue={medicine?.name} placeholder="e.g. Panadol" autoFocus={!medicine} />
        </div>
        <div>
          <label htmlFor="strength" className="label">Strength</label>
          <input id="strength" name="strength" className="field" defaultValue={medicine?.strength} placeholder="e.g. 500mg" />
        </div>
        <div>
          <label htmlFor="form" className="label">Form</label>
          <select id="form" name="form" className="field" defaultValue={medicine?.form || "Tablet"}>
            {siteConfig.medicineForms.map((f) => <option key={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="generic_name" className="label">Generic (salt)</label>
          <input id="generic_name" name="generic_name" className="field" defaultValue={medicine?.generic_name} placeholder="e.g. Paracetamol" />
        </div>
        <div>
          <label htmlFor="company" className="label">Company</label>
          <input id="company" name="company" list="companies" className="field" defaultValue={medicine?.company} placeholder="e.g. GSK" />
          <datalist id="companies">{companies.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
        <div>
          <label htmlFor="category" className="label">Category</label>
          <input id="category" name="category" list="categories" className="field" defaultValue={medicine?.category} placeholder="e.g. Pain relief" />
          <datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist>
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 border-t border-[var(--color-border)] pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="sr-only">Packing and price</legend>
        <div>
          <label htmlFor="units_per_pack" className="label">Units per pack</label>
          <input id="units_per_pack" name="units_per_pack" inputMode="numeric" required className="field text-right tabular-nums" value={perPack} onChange={(e) => setPerPack(e.target.value.replace(/\D/g, ""))} />
          <p className="hint">Tablets in a strip, or 1 for a bottle or tube.</p>
        </div>
        <div>
          <label htmlFor="sale_price_per_pack" className="label">Sale price per pack (Rs)</label>
          <input id="sale_price_per_pack" name="sale_price_per_pack" inputMode="decimal" className="field text-right tabular-nums" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} placeholder="e.g. 150" />
          <p className="hint">{per > 1 && Number(price) > 0 ? `Loose: ${formatRs(unitPrice(price, per))} each.` : "Printed retail price (MRP). A purchase can update it."}</p>
        </div>
        <div>
          <label htmlFor="reorder_level_packs" className="label">Reorder at (packs)</label>
          <input id="reorder_level_packs" name="reorder_level_packs" inputMode="decimal" className="field text-right tabular-nums" defaultValue={medicine ? medicine.reorder_level / medicine.units_per_pack : ""} placeholder="e.g. 5" />
          <p className="hint">Shown as low stock at or below this.</p>
        </div>
        <div>
          <label htmlFor="tax_percent" className="label">Sales tax %</label>
          <input id="tax_percent" name="tax_percent" inputMode="decimal" className="field text-right tabular-nums" defaultValue={medicine?.tax_percent ?? 0} />
          <p className="hint">Usually 0 for medicines.</p>
        </div>
      </fieldset>

      <fieldset className="grid grid-cols-1 gap-4 border-t border-[var(--color-border)] pt-5 sm:grid-cols-2 lg:grid-cols-4">
        <legend className="sr-only">Shelf</legend>
        <div>
          <label htmlFor="barcode" className="label">Barcode</label>
          <input id="barcode" name="barcode" className="field font-mono" defaultValue={medicine?.barcode ?? ""} placeholder="Scan the pack" />
        </div>
        <div>
          <label htmlFor="rack" className="label">Rack / shelf</label>
          <input id="rack" name="rack" className="field" defaultValue={medicine?.rack} placeholder="e.g. B3" />
        </div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
          <input type="checkbox" name="allow_loose" defaultChecked={medicine ? medicine.allow_loose : true} disabled={per === 1} />
          Can sell loose (single units)
        </label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm font-medium">
          <input type="checkbox" name="rx_required" defaultChecked={medicine?.rx_required} />
          Prescription only (Rx)
        </label>
      </fieldset>

      {state && !state.ok ? <FormMessage state={state} /> : null}
      <div className="flex justify-end gap-2">
        <SubmitButton pendingLabel="Saving...">{medicine ? "Save changes" : "Add medicine"}</SubmitButton>
      </div>
    </form>
  );
}
