"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, todayPK } from "@/app/_lib/date-helpers";
import { useTrackPending } from "@/app/_components/layout/NavigationProgress";

// Steps through business days, keeping every other query param.
export default function DayPicker({ value, param = "date" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [isPending, startTransition] = useTransition();
  useTrackPending(isPending, { dim: true });
  const today = todayPK();

  function go(day) {
    const sp = new URLSearchParams(params.toString());
    if (!day || day === today) sp.delete(param);
    else sp.set(param, day);
    sp.delete("page");
    const qs = sp.toString();
    startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <div className="flex items-center gap-1">
      <button type="button" className="btn btn-secondary btn-sm px-2" onClick={() => go(addDays(value, -1))} aria-label="Previous day">
        <ChevronLeft className="h-4 w-4" aria-hidden />
      </button>
      <input type="date" aria-label="Day" className="field w-40" value={value} max={today} onChange={(e) => e.target.value && go(e.target.value)} />
      <button type="button" className="btn btn-secondary btn-sm px-2" onClick={() => go(addDays(value, 1))} disabled={value >= today} aria-label="Next day">
        <ChevronRight className="h-4 w-4" aria-hidden />
      </button>
      {value !== today ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => go(today)}>Today</button>
      ) : null}
    </div>
  );
}
