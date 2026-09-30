// Ported from PMC-Hospital src/components/skeletons/page-header-skeleton.tsx.
// Copy to app/_components/ui/PageHeaderSkeleton.js.

import { SkeletonLine } from "@/app/_components/ui/Skeleton";

// Mirrors the real PageHeader, for pages whose title is not known before the
// data arrives (a patient's name, "Good morning, Ammar"). Anything that IS
// known (a fixed page name, a fixed description) is passed in and rendered
// for real; only the unknown parts are placeheld.
//
// The markup must track PageHeader's: its title is text-xl (h-7 line) and its
// description text-sm (h-5), which is what keeps the content below from
// shifting when the real header replaces this one.
export function PageHeaderSkeleton({ title, description, descriptionWidth = "w-96", titleWidth = "w-56", actions }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--color-border)] px-4 pt-6 pb-4 sm:px-6">
      <div className="flex flex-col gap-1">
        {title ? (
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        ) : (
          <SkeletonLine line="h-7" bar="h-5" width={titleWidth} />
        )}
        {description ? (
          <p className="text-sm text-[var(--color-muted)]">{description}</p>
        ) : (
          <SkeletonLine line="h-5" bar="h-3.5" width={descriptionWidth} delay={0.06} />
        )}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
