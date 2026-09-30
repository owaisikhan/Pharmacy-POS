"use client";

// Ported from PMC-Hospital src/components/layout/navigation-progress.tsx.
// Copy to app/_components/layout/NavigationProgress.js.
//
// A loading indicator for every in-app navigation, including the ones that
// only change the query string (Today -> This week, a sort header, a filter,
// the next page). Those keep the same route, so no loading.js skeleton shows,
// and until the server answers the old figures just sit there.
//
// Two cues: a thin bar across the top of the window, and the page content
// dimmed so the figures on screen read as the ones being replaced.
//
// Started by one click listener on the document rather than by each link, so
// every <Link> in the app is covered, including ones added later, with no
// change to them. Finished when the URL the router shows actually changes.
//
// Mount once in the app layout, inside a <Suspense> (useSearchParams needs it):
//   <Suspense><NavigationProgressProvider>{children}</NavigationProgressProvider></Suspense>
// and wrap the page body in <PendingRegion> so it dims while replaced.

import { usePathname, useSearchParams } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";

// Only show anything if it is still loading after this long, so a fast or
// prefetched navigation does not flash the bar.
const SHOW_AFTER_MS = 120;
// Give up on anything that never finishes (an errored navigation, a redirect
// back to the same URL) rather than leave the page dimmed forever.
const GIVE_UP_AFTER_MS = 15_000;

const ProgressContext = createContext(null);
const PendingContext = createContext(false);

export function NavigationProgressProvider({ children }) {
  // Each thing currently loading, and whether it wants the content dimmed.
  const [active, setActive] = useState({});
  const nextId = useRef(0);

  const begin = useCallback(({ dim }) => {
    const id = nextId.current++;
    setActive((current) => ({ ...current, [id]: dim }));
    let ended = false;
    const end = () => {
      if (ended) return;
      ended = true;
      clearTimeout(giveUp);
      setActive((current) => {
        const rest = { ...current };
        delete rest[id];
        return rest;
      });
    };
    const giveUp = setTimeout(end, GIVE_UP_AFTER_MS);
    return end;
  }, []);

  const endNavigation = useRef(null);
  const pathname = usePathname();
  const search = useSearchParams().toString();

  useEffect(() => {
    const onClick = (event) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = event.target?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const next = new URL(anchor.href, window.location.href);
      if (next.origin !== window.location.origin) return;
      // Same page, or only the #hash differs: nothing will load.
      if (next.pathname === window.location.pathname && next.search === window.location.search) return;

      endNavigation.current?.();
      endNavigation.current = begin({ dim: true });
    };

    // Capture phase: <Link> calls preventDefault in its own handler, which
    // would hide the click from a bubbling listener that checks for it.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [begin]);

  useEffect(() => {
    endNavigation.current?.();
    endNavigation.current = null;
  }, [pathname, search]);

  const pending = Object.keys(active).length > 0;
  const dim = Object.values(active).some(Boolean);

  // The bar's own life cycle, a step behind `pending`: it appears only after
  // SHOW_AFTER_MS, and on finishing it runs to the end and fades.
  const [phase, setPhase] = useState("idle");
  useEffect(() => {
    if (pending) {
      const show = setTimeout(() => setPhase("loading"), SHOW_AFTER_MS);
      return () => clearTimeout(show);
    }
    const finish = setTimeout(() => setPhase((p) => (p === "loading" ? "done" : "idle")), 0);
    const reset = setTimeout(() => setPhase("idle"), 500);
    return () => {
      clearTimeout(finish);
      clearTimeout(reset);
    };
  }, [pending]);

  // Stable, so useTrackPending does not restart its entry on every render.
  const progress = useMemo(() => ({ begin }), [begin]);

  return (
    <ProgressContext.Provider value={progress}>
      <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-[3px]">
        <div data-phase={phase} className="nav-progress h-full" />
      </div>
      <PendingContext.Provider value={phase === "loading" && dim}>{children}</PendingContext.Provider>
    </ProgressContext.Provider>
  );
}

// The part of the page that dims while it is being replaced.
export function PendingRegion({ children }) {
  const pending = useContext(PendingContext);
  return (
    <div
      aria-busy={pending || undefined}
      className={clsx("transition-opacity duration-300 ease-out", pending && "opacity-55 duration-200")}
    >
      {children}
    </div>
  );
}

// For loading that is not a link click (a search box waiting on results).
// Shows the bar for as long as isPending is true. Pass { dim: false } for a
// search box, where the person is still typing into the page being dimmed.
export function useTrackPending(isPending, options = { dim: false }) {
  const progress = useContext(ProgressContext);
  const { dim } = options;
  useEffect(() => {
    if (!isPending || !progress) return;
    return progress.begin({ dim });
  }, [isPending, progress, dim]);
}
