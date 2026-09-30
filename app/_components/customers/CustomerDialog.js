"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, UserPlus } from "lucide-react";
import { saveCustomer } from "@/app/_lib/actions";
import Dialog from "@/app/_components/ui/Dialog";
import FormMessage from "@/app/_components/ui/FormMessage";
import SubmitButton from "@/app/_components/ui/SubmitButton";
import { useActionForm } from "@/app/_components/layout/ToastProvider";

export default function CustomerDialog({ customer, isAdmin }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, action] = useActionForm(saveCustomer, {
    onSuccess: (s) => {
      setOpen(false);
      if (!customer) router.push(`/customers/${s.id}`);
    },
  });
  return (
    <>
      <button type="button" className={`btn ${customer ? "btn-secondary" : "btn-primary"}`} onClick={() => setOpen(true)}>
        {customer ? <Pencil className="h-4 w-4" aria-hidden /> : <UserPlus className="h-4 w-4" aria-hidden />}
        {customer ? "Edit" : "Add customer"}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={customer ? `Edit ${customer.name}` : "Add customer"} size="sm">
        <form action={action} className="flex flex-col gap-3">
          {customer ? <input type="hidden" name="id" value={customer.id} /> : null}
          <div>
            <label htmlFor="c-name" className="label">Name</label>
            <input id="c-name" name="name" required className="field" defaultValue={customer?.name} placeholder="e.g. Ahmed Raza" />
          </div>
          <div>
            <label htmlFor="c-phone" className="label">Phone</label>
            <input id="c-phone" name="phone" inputMode="tel" className="field" defaultValue={customer?.phone} placeholder="e.g. 0300 1234567" />
          </div>
          <div>
            <label htmlFor="c-address" className="label">Address</label>
            <input id="c-address" name="address" className="field" defaultValue={customer?.address} placeholder="e.g. House 12, Street 4" />
          </div>
          {isAdmin ? (
            <div>
              <label htmlFor="c-limit" className="label">Credit limit (Rs)</label>
              <input id="c-limit" name="credit_limit" inputMode="decimal" className="field text-right tabular-nums" defaultValue={customer?.credit_limit ?? 0} />
              <p className="hint">0 means no limit. A sale that would pass the limit is refused.</p>
            </div>
          ) : null}
          <div>
            <label htmlFor="c-notes" className="label">Notes</label>
            <input id="c-notes" name="notes" className="field" defaultValue={customer?.notes} placeholder="e.g. Regular, diabetic medicines monthly" />
          </div>
          {customer && isAdmin ? (
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" name="active" defaultChecked={customer.active} /> Active (untick to retire)
            </label>
          ) : null}
          {customer && isAdmin ? <input type="hidden" name="active_present" value="1" /> : null}
          {state && !state.ok ? <FormMessage state={state} /> : null}
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
            <SubmitButton>{customer ? "Save" : "Add customer"}</SubmitButton>
          </div>
        </form>
      </Dialog>
    </>
  );
}
