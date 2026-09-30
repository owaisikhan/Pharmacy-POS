"use client";

import { useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useTrackPending } from "@/app/_components/layout/NavigationProgress";

// A custom date range. Presets are plain links beside it.
export default function RangePicker({ from, to, max }) {
  const router = useRouter();
  const pathname = usePathname();
  const [a, setA] = useState(from);
  const [b, setB] = useState(to);
  const [isPending, startTransition] = useTransition();
  useTrackPending(isPending, { dim: true });
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(() => router.push(`${pathname}?from=${a}&to=${b}`, { scroll: false }));
      }}
    >
      <div>
        <label htmlFor="r-from" className="label">From</label>
        <input id="r-from" type="date" className="field w-40" max={max} value={a} onChange={(e) => setA(e.target.value)} required />
      </div>
      <div>
        <label htmlFor="r-to" className="label">To</label>
        <input id="r-to" type="date" className="field w-40" max={max} min={a} value={b} onChange={(e) => setB(e.target.value)} required />
      </div>
      <button type="submit" className="btn btn-secondary">Show</button>
    </form>
  );
}
