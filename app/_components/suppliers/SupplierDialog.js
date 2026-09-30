"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { saveSupplier } from "@/app/_lib/actions";
import Dialog from "@/app/_components/ui/Dialog";
import FormMessage from "@/app/_components/ui/FormMessage";
import SubmitButton from "@/app/_components/ui/SubmitButton";
import { useActionForm } from "@/app/_components/layout/ToastProvider";

export default function SupplierDialog({ supplier }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionForm(saveSupplier, {
    onSuccess: (s) => {
      setOpen(false);
      if (!supplier) router.push(`/suppliers/${s.id}`);
    },
  });
  return (
    <>
      <button type="button" className={`btn ${supplier ? "btn-secondary" : "btn-primary"}`} onClick={() => setOpen(true)}>
        {supplier ? <Pencil className="h-4 w-4" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
        {supplier ? "Edit" : "Add supplier"}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={supplier ? `Edit ${supplier.name}` : "Add supplier"} size="sm">
        <form action={action} className="flex flex-col gap-3">
          {supplier ? <input type="hidden" name="id" value={supplier.id} /> : null}
          <div>
            <label htmlFor="s-name" className="label">Name</label>
            <input id="s-name" name="name" required className="field" defaultValue={supplier?.name} placeholder="e.g. Muller and Phipps" />
          </div>
          <div>
            <label htmlFor="s-phone" className="label">Phone</label>
            <input id="s-phone" name="phone" className="field" defaultValue={supplier?.phone} placeholder="e.g. 042 111 222 333" />
          </div>
          <div>
            <label htmlFor="s-address" className="label">Address</label>
            <input id="s-address" name="address" className="field" defaultValue={supplier?.address} />
          </div>
          <div>
            <label htmlFor="s-notes" className="label">Notes</label>
            <input id="s-notes" name="notes" className="field" defaultValue={supplier?.notes} placeholder="e.g. Salesman Asif, visits Mondays" />
          </div>
          {supplier ? (
            <>
              <input type="hidden" name="active_present" value="1" />
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="checkbox" name="active" defaultChecked={supplier.active} /> Active (untick to retire)
              </label>
            </>
          ) : null}
          {state && !state.ok ? <FormMessage state={state} /> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <SubmitButton>{supplier ? "Save" : "Add supplier"}</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
