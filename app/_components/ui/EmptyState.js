// Empty is a state with a reason, written on it.
export default function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--color-border)] bg-[var(--color-surface)] px-6 py-10 text-center">
      {Icon ? <Icon className="h-6 w-6 text-[var(--color-muted)]" aria-hidden /> : null}
      <p className="text-sm font-semibold">{title}</p>
      {children ? <div className="max-w-md text-sm text-[var(--color-muted)]">{children}</div> : null}
    </div>
  );
}
