import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { formatRs } from "@/app/_lib/format-helpers";

// A balance shows its magnitude, with direction in words and an icon, never
// a bare minus in front of "Rs". owesWord/aheadWord let a supplier read
// "We owe" and "Paid ahead".
export default function Balance({ value, owesWord = "Owes", aheadWord = "Paid ahead", strong = true }) {
  const n = Number(value);
  if (!n) return <span className="text-[var(--color-muted)]">Settled</span>;
  const owes = n > 0;
  const Icon = owes ? ArrowUpRight : ArrowDownLeft;
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap ${strong ? "font-semibold" : ""} ${owes ? "text-[var(--color-warning)]" : "text-[var(--color-primary)]"}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {owes ? owesWord : aheadWord} {formatRs(n)}
    </span>
  );
}
