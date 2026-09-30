import { CircleAlert, CircleCheck } from "lucide-react";
import clsx from "clsx";

// Renders any { ok, message } result. An icon rides beside the colour, so the
// meaning survives poor light and colour blindness.
export default function FormMessage({ state, className }) {
  if (!state?.message) return null;
  const Icon = state.ok ? CircleCheck : CircleAlert;
  return (
    <p
      role={state.ok ? "status" : "alert"}
      className={clsx(
        "flex items-start gap-2 rounded-lg px-3 py-2 text-sm font-medium",
        state.ok ? "bg-[var(--color-primary-soft)] text-[var(--color-primary)]" : "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
        className
      )}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{state.message}</span>
    </p>
  );
}
