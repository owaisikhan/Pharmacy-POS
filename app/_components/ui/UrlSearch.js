"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { useTrackPending } from "@/app/_components/layout/NavigationProgress";

// The search term lives in the URL: results stay server-rendered, a refresh
// keeps them, and Back walks through searches. Other params ride along; the
// page resets to 1.
export default function UrlSearch({ placeholder = "Search", param = "q", autoFocus = false, label = "Search" }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get(param) ?? "");
  const [isPending, startTransition] = useTransition();
  const timer = useRef(null);
  useTrackPending(isPending, { dim: false });

  useEffect(() => () => clearTimeout(timer.current), []);

  function push(next) {
    const sp = new URLSearchParams(params.toString());
    if (next.trim()) sp.set(param, next.trim());
    else sp.delete(param);
    sp.delete("page");
    const qs = sp.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <label className="relative block w-full max-w-sm">
      <span className="sr-only">{label}</span>
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--color-muted)]" aria-hidden />
      <input
        type="search"
        className="field pl-9"
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => {
          const next = e.target.value;
          setValue(next);
          clearTimeout(timer.current);
          timer.current = setTimeout(() => push(next), 300);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            clearTimeout(timer.current);
            push(value);
          }
        }}
      />
    </label>
  );
}
