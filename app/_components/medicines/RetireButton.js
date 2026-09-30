"use client";

import { useState, useTransition } from "react";
import { setMedicineActive } from "@/app/_lib/actions";
import Dialog from "@/app/_components/ui/Dialog";
import FormMessage from "@/app/_components/ui/FormMessage";
import Spinner from "@/app/_components/ui/Spinner";
import { useToast } from "@/app/_components/layout/ToastProvider";

// Medicines with history are never deleted: they are retired and can come back.
export default function RetireButton({ medicine }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [state, setState] = useState(null);
  const [isPending, startTransition] = useTransition();
  const retire = medicine.active;

  function confirm() {
    startTransition(async () => {
      const r = await setMedicineActive(medicine.id, !retire);
      setState(r);
      if (r.ok) {
        toast(r);
        setOpen(false);
      }
    });
  }

  return (
    <>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>{retire ? "Retire" : "Put back on sale"}</button>
      <Dialog open={open} onClose={() => setOpen(false)} title={retire ? `Retire ${medicine.name}?` : `Put ${medicine.name} back on sale?`} size="sm">
        <p className="text-sm">
          {retire
            ? "It will no longer appear on the sale screen or in purchases. Its bills, batches and history stay. You can put it back on sale later."
            : "It will appear on the sale screen again."}
        </p>
        <FormMessage state={state && !state.ok ? state : null} className="mt-3" />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
          <button type="button" className={`btn ${retire ? "btn-danger" : "btn-primary"}`} onClick={confirm} disabled={isPending}>
            {isPending ? <Spinner /> : null} {retire ? "Retire" : "Put back on sale"}
          </button>
        </div>
      </Dialog>
    </>
  );
}
