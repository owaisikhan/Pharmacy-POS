// Ported from PMC-Hospital src/components/skeletons/table-skeleton.tsx.
// Copy to app/_components/ui/TableSkeleton.js.

import { Skeleton, SkeletonLine } from "@/app/_components/ui/Skeleton";

// Mirrors the real table: same wrapper, same min-width, same cell padding, so
// the rows do not resize when the data lands. Copy the real table's wrapper
// classes exactly rather than approximating them.
//
// columns: [{ label, bar: "w-24", align?: "right", head?: "w-14", hiddenLabel?: true, subBar?: "w-16" }]
//   label        column headings are fixed copy, so they render for real
//   subBar       a second, smaller line, for columns whose real rows carry a
//                detail under the main value (otherwise every row is short)
//
// min-w-0 matters: a flex child defaults to min-width:auto, so without it the
// wrapper grows to the table's width and scrolls the whole page sideways.
// relative matters: sr-only is position:absolute, and with no positioned
// ancestor a hidden label escapes the scroller and widens the page.
export function TableSkeleton({ columns, rows = 6, minWidth, caption }) {
  return (
    <div className="relative min-w-0 overflow-x-auto rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]">
      <table className={`w-full ${minWidth} border-collapse text-sm`}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-[var(--color-border)] text-left">
            {columns.map((c) => (
              <th
                key={c.label}
                scope="col"
                className={["px-3 py-2.5 font-medium text-[var(--color-muted)]", c.align === "right" ? "text-right" : "", c.head ?? ""].filter(Boolean).join(" ")}
              >
                {c.hiddenLabel ? <span className="sr-only">{c.label}</span> : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody aria-busy="true">
          {Array.from({ length: rows }, (_, r) => (
            <tr key={r} className="border-b border-[var(--color-border-soft)] last:border-b-0">
              {columns.map((c, ci) => (
                <td key={c.label} className="px-3 py-2.5">
                  {/* text-sm cells, so the line box is h-5. Each row starts
                      a little later, so the table fills in as one sweep. */}
                  <SkeletonLine line="h-5" bar="h-3.5" width={c.bar} align={c.align} delay={r * 0.1 + ci * 0.03} />
                  {c.subBar ? (
                    <SkeletonLine line="h-5" bar="h-3" width={c.subBar} align={c.align} delay={r * 0.1 + ci * 0.03 + 0.04} />
                  ) : null}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The one-line summary that sits above a table ("128 patients, 14 admitted").
export function TableSummarySkeleton({ width = "w-72" }) {
  return <SkeletonLine line="h-6" bar="h-4" width={width} />;
}

// A filter chip group in a page header, at its real height.
export function FilterGroupSkeleton({ width }) {
  return <Skeleton className={`h-[2.875rem] ${width} rounded-lg`} />;
}
