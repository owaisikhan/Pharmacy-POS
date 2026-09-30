"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CircleAlert, CircleCheck, X } from "lucide-react";
import clsx from "clsx";
import { useActionState } from "react";

// One feed of every action result, mounted once. The inline FormMessage
// vanishes with its dialog; the toast is what confirms the save.
const ToastContext = createContext({ toast: () => {} });

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => setItems((list) => list.filter((t) => t.id !== id)), []);
  const toast = useCallback(
    (result) => {
      if (!result?.message) return;
      const id = nextId.current++;
      setItems((list) => [...list.slice(-3), { id, ok: result.ok !== false, message: result.message }]);
      setTimeout(() => dismiss(id), result.ok === false ? 8000 : 4000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div aria-live="polite" className="no-print pointer-events-none fixed right-4 bottom-4 z-[70] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {items.map((t) => {
          const Icon = t.ok ? CircleCheck : CircleAlert;
          return (
            <div
              key={t.id}
              role={t.ok ? "status" : "alert"}
              className={clsx(
                "pointer-events-auto flex items-start gap-2 rounded-lg border bg-[var(--color-surface)] px-3 py-2.5 text-sm shadow-lg",
                t.ok ? "border-[var(--color-primary)]" : "border-[var(--color-danger)]"
              )}
            >
              <Icon className={clsx("mt-0.5 h-4 w-4 shrink-0", t.ok ? "text-[var(--color-primary)]" : "text-[var(--color-danger)]")} aria-hidden />
              <span className="flex-1 font-medium">{t.message}</span>
              <button type="button" onClick={() => dismiss(t.id)} className="rounded p-0.5 text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]" aria-label="Dismiss">
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext).toast;
}

// useActionState plus a toast on success, and an onSuccess hook (close a
// dialog, reset a form). Failure stays inline where it happened.
export function useActionForm(action, { onSuccess, initial = null } = {}) {
  const toast = useToast();
  const [state, formAction, pending] = useActionState(action, initial);
  const seen = useRef(null);
  useEffect(() => {
    if (!state || seen.current === state) return;
    seen.current = state;
    if (state.ok) {
      toast(state);
      onSuccess?.(state);
    }
  }, [state, toast, onSuccess]);
  return [state, formAction, pending];
}
