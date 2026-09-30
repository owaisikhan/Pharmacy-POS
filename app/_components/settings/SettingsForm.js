"use client";

import { updateSettings } from "@/app/_lib/actions";
import FormMessage from "@/app/_components/ui/FormMessage";
import SubmitButton from "@/app/_components/ui/SubmitButton";
import { useActionForm } from "@/app/_components/layout/ToastProvider";

export default function SettingsForm({ settings }) {
  const [state, action] = useActionForm(updateSettings);
  return (
    <form action={action} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="pharmacy_name" className="label">Pharmacy name</label>
        <input id="pharmacy_name" name="pharmacy_name" required className="field" defaultValue={settings.pharmacy_name} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="address" className="label">Address</label>
        <input id="address" name="address" className="field" defaultValue={settings.address} placeholder="e.g. Shop 4, Main Boulevard, Lahore" />
      </div>
      <div>
        <label htmlFor="phone" className="label">Phone</label>
        <input id="phone" name="phone" className="field" defaultValue={settings.phone} placeholder="e.g. 042 3571 0000" />
      </div>
      <div>
        <label htmlFor="licence_no" className="label">Drug sale licence number</label>
        <input id="licence_no" name="licence_no" className="field" defaultValue={settings.licence_no} />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="receipt_footer" className="label">Receipt footer</label>
        <textarea id="receipt_footer" name="receipt_footer" rows={2} className="field" defaultValue={settings.receipt_footer} />
        <p className="hint">Printed at the bottom of every receipt, for example your return policy.</p>
      </div>
      {state && !state.ok ? <FormMessage state={state} className="sm:col-span-2" /> : null}
      <div className="sm:col-span-2 flex justify-end">
        <SubmitButton>Save details</SubmitButton>
      </div>
    </form>
  );
}
