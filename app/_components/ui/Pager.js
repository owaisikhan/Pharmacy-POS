import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { hrefWith } from "@/app/_lib/url-helpers";
import { formatCount } from "@/app/_lib/format-helpers";

// Previous / next that carries every other query param. A dead control is a
// <span>, not a faded link that still takes focus.
export default function Pager({ pathname, params, page, count, pageSize = 25, noun = "rows" }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (count === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(count, page * pageSize);
  const cls = "btn btn-secondary btn-sm";
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--color-muted)]">
      <span className="tabular-nums">
        {formatCount(first)} to {formatCount(last)} of {formatCount(count)} {noun}
      </span>
      {pages > 1 ? (
        <span className="flex items-center gap-2">
          {page > 1 ? (
            <Link scroll={false} className={cls} href={hrefWith(pathname, params, { page: page - 1 === 1 ? "" : page - 1 })}>
              <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
            </Link>
          ) : (
            <span className={`${cls} opacity-45`} aria-disabled="true">
              <ChevronLeft className="h-4 w-4" aria-hidden /> Previous
            </span>
          )}
          <span className="tabular-nums">
            Page {page} of {pages}
          </span>
          {page < pages ? (
            <Link scroll={false} className={cls} href={hrefWith(pathname, params, { page: page + 1 })}>
              Next <ChevronRight className="h-4 w-4" aria-hidden />
            </Link>
          ) : (
            <span className={`${cls} opacity-45`} aria-disabled="true">
              Next <ChevronRight className="h-4 w-4" aria-hidden />
            </span>
          )}
        </span>
      ) : null}
    </nav>
  );
}
