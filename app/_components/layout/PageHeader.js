// Title, one line of description, and the page's actions. Its skeleton twin
// (PageHeaderSkeleton) keeps the exact line heights: text-xl (h-7), text-sm (h-5).
export default function PageHeader({ title, description, actions, children }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 pt-6 pb-4 sm:px-6">
      <div className="flex min-w-0 flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="text-sm text-[var(--color-muted)]">{description}</p> : null}
        {children}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}
