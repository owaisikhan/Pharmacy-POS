import Link from "next/link";
import clsx from "clsx";
import { hrefWith } from "@/app/_lib/url-helpers";

// A row of filters in the URL. The selected one is a <span aria-current>,
// not a link to the page you are already on.
export default function FilterTabs({ pathname, params, param = "filter", options, value }) {
  return (
    <div role="group" className="inline-flex flex-wrap gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
      {options.map((o) => {
        const active = o.value === value;
        const cls = clsx(
          "rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap",
          active ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]"
        );
        return active ? (
          <span key={o.value} aria-current="true" className={cls}>
            {o.label}
          </span>
        ) : (
          <Link key={o.value} scroll={false} className={cls} href={hrefWith(pathname, params, { [param]: o.value === options[0].value ? "" : o.value, page: "" })}>
            {o.label}
          </Link>
        );
      })}
    </div>
  );
}
