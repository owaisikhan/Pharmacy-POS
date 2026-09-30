import { CalendarX, PackageX, TriangleAlert } from "lucide-react";
import Badge from "@/app/_components/ui/Badge";
import { daysBetween } from "@/app/_lib/date-helpers";

export function StockBadge({ medicine }) {
  if (!medicine.active) return <Badge>Retired</Badge>;
  if (medicine.sellable_units <= 0) return <Badge tone="bad" icon={PackageX}>Out of stock</Badge>;
  if (medicine.is_low) return <Badge tone="warn" icon={TriangleAlert}>Low</Badge>;
  return null;
}

// "Expired", "12 days left", "2 months left". Colour always paired with words.
export function ExpiryBadge({ expiry, today }) {
  if (!expiry) return null;
  const days = daysBetween(today, expiry);
  if (days < 0) return <Badge tone="bad" icon={CalendarX}>Expired</Badge>;
  if (days <= 30) return <Badge tone="bad">{days === 0 ? "Expires today" : `${days} day${days === 1 ? "" : "s"} left`}</Badge>;
  if (days <= 90) return <Badge tone="warn">{Math.round(days / 30)} month{Math.round(days / 30) === 1 ? "" : "s"} left</Badge>;
  return null;
}
