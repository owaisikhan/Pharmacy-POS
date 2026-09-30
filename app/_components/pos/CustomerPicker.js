"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { UserPlus, UserRound, X } from "lucide-react";
import { saveCustomer } from "@/app/_lib/actions";
import { formatRs } from "@/app/_lib/format-helpers";
import Dialog from "@/app/_components/ui/Dialog";
import FormMessage from "@/app/_components/ui/FormMessage";
import SubmitButton from "@/app/_components/ui/SubmitButton";
import { useActionForm } from "@/app/_components/layout/ToastProvider";

// Walk-in by default. Search by name or phone, or add a new customer without
// leaving the bill.
export default function CustomerPicker({ value, onChange }) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [hi, setHi] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (!term) return;
    const t = setTimeout(async () => {
      const mine = ++seq.current;
      try {
        const res = await fetch(`/api/pos/customers?q=${encodeURIComponent(term)}`, { cache: "no-store" });
        const json = await res.json();
        if (mine === seq.current && res.ok) {
          setResults(json.results);
          setHi(0);
        }
      } catch {}
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  function pick(c) {
    onChange(c);
    setQ("");
    setResults([]);
    setOpen(false);
  }

  if (value) {
    const owes = Number(value.balance) > 0;
    return (
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-primary-soft)] text-[var(--color-primary)]">
            <UserRound className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{value.name}</p>
            <p className="text-xs text-[var(--color-muted)]">
              {value.phone || "No phone"} ·{" "}
              {Number(value.balance) === 0 ? "Nothing owed" : owes ? `Owes ${formatRs(value.balance)}` : `Paid ahead ${formatRs(value.balance)}`}
            </p>
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(null)} aria-label="Remove customer">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }

  const shown = q.trim() ? results : [];
  return (
    <div className="relative">
      <div className="mb-1 flex items-center justify-between">
        <label htmlFor="customer-search" className="label mb-0">Customer</label>
        <button type="button" className="btn btn-ghost btn-sm text-[var(--color-primary)]" onClick={() => setAdding(true)}>
          <UserPlus className="h-4 w-4" aria-hidden /> New
        </button>
      </div>
      <input
        id="customer-search"
        className="field"
        autoComplete="off"
        placeholder="Walk-in. Type a name or phone to choose."
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHi((h) => Math.min(h + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHi((h) => Math.max(h - 1, 0));
          } else if (e.key === "Enter" && shown[hi]) {
            e.preventDefault();
            pick(shown[hi]);
          }
        }}
      />
      {open && shown.length > 0 ? (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-xl" role="listbox">
          {shown.map((c, i) => (
            <li
              key={c.id}
              role="option"
              aria-selected={i === hi}
              onMouseEnter={() => setHi(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(c);
              }}
              className={clsx("flex cursor-pointer justify-between gap-3 px-3 py-2 text-sm", i === hi && "bg-[var(--color-primary-soft)]")}
            >
              <span className="min-w-0 truncate">
                <span className="font-semibold">{c.name}</span> <span className="text-[var(--color-muted)]">{c.phone}</span>
              </span>
              {Number(c.balance) > 0 ? <span className="num text-xs text-[var(--color-warning)]">Owes {formatRs(c.balance)}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <NewCustomerDialog
        open={adding}
        onClose={() => setAdding(false)}
        onCreated={(c) => {
          setAdding(false);
          pick(c);
        }}
      />
    </div>
  );
}

function NewCustomerDialog({ open, onClose, onCreated }) {
  const [state, action] = useActionForm(saveCustomer, { onSuccess: (s) => onCreated(s.customer) });
  return (
    <Dialog open={open} onClose={onClose} title="New customer" description="Added to your customer list and chosen for this bill." size="sm">
      <form action={action} className="flex flex-col gap-3">
        <div>
          <label htmlFor="nc-name" className="label">Name</label>
          <input id="nc-name" name="name" required className="field" autoFocus placeholder="e.g. Ahmed Raza" />
        </div>
        <div>
          <label htmlFor="nc-phone" className="label">Phone</label>
          <input id="nc-phone" name="phone" inputMode="tel" className="field" placeholder="e.g. 0300 1234567" />
        </div>
        {state && !state.ok ? <FormMessage state={state} /> : null}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <SubmitButton pendingLabel="Adding...">Add customer</SubmitButton>
        </div>
      </form>
    </Dialog>
  );
}
