import { Pill } from "lucide-react";

export default function AuthCard({ title, description, children, footer }) {
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--color-primary)] text-white">
            <Pill className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-base font-semibold">Pharmacy POS</span>
        </div>
        <div className="card p-6">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description ? <p className="mt-1 text-sm text-[var(--color-muted)]">{description}</p> : null}
          <div className="mt-5">{children}</div>
        </div>
        {footer ? <div className="mt-4 text-center text-sm text-[var(--color-muted)]">{footer}</div> : null}
      </div>
    </main>
  );
}
