import clsx from "clsx";

const TONES = {
  neutral: "bg-[var(--color-surface-2)] text-[var(--color-muted)]",
  good: "bg-[var(--color-primary-soft)] text-[var(--color-primary)]",
  warn: "bg-[var(--color-warning-soft)] text-[var(--color-warning)]",
  bad: "bg-[var(--color-danger-soft)] text-[var(--color-danger)]",
  info: "bg-[var(--color-info-soft)] text-[var(--color-info)]",
};

// Always carries a word, never colour alone. Pass an icon for extra weight.
export default function Badge({ tone = "neutral", icon: Icon, children, className }) {
  return (
    <span className={clsx("badge", TONES[tone], className)}>
      {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
      {children}
    </span>
  );
}
