import clsx from "clsx";

// A figure the owner checks against the drawer. The figure is bigger than its
// label, never wraps, and the note under it says which moment it describes.
export default function StatCard({ label, value, note, tone, icon: Icon }) {
  return (
    <div className="card flex flex-col gap-1 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-muted)]">
        {Icon ? <Icon className="h-4 w-4" aria-hidden /> : null}
        {label}
      </p>
      <p className={clsx("text-2xl font-bold tracking-tight whitespace-nowrap tabular-nums", tone === "bad" && "text-[var(--color-danger)]", tone === "good" && "text-[var(--color-primary)]")}>
        {value}
      </p>
      {note ? <p className="mt-auto text-xs text-[var(--color-muted)]">{note}</p> : null}
    </div>
  );
}
