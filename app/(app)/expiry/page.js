import Link from "next/link";
import { CalendarCheck } from "lucide-react";
import PageHeader from "@/app/_components/layout/PageHeader";
import FilterTabs from "@/app/_components/ui/FilterTabs";
import Pager from "@/app/_components/ui/Pager";
import EmptyState from "@/app/_components/ui/EmptyState";
import AdjustStockDialog from "@/app/_components/medicines/AdjustStockDialog";
import { ExpiryBadge } from "@/app/_components/medicines/StockBadges";
import { listExpiring } from "@/app/_lib/data-service";
import { requireUser } from "@/app/_lib/helpers";
import { pageNumber } from "@/app/_lib/url-helpers";
import { formatExpiry, formatRs, formatUnits } from "@/app/_lib/format-helpers";

export const metadata = { title: "Expiry" };

const WINDOWS = [
  { value: "90", label: "Next 90 days" },
  { value: "60", label: "Next 60 days" },
  { value: "30", label: "Next 30 days" },
  { value: "expired", label: "Already expired" },
];

export default async function ExpiryPage({ searchParams }) {
  const { isAdmin } = await requireUser();
  const sp = await searchParams;
  const window = WINDOWS.some((w) => w.value === sp.window) ? sp.window : "90";
  const page = pageNumber(sp.page);
  const { rows, count, today } = await listExpiring({ window, page, withCost: isAdmin });
  const params = { window: sp.window, page: sp.page };

  return (
    <>
      <PageHeader
        title="Expiry"
        description="Batches in stock by expiry date. Sales always take the earliest expiry first; expired batches are never sold."
      />
      <div className="flex flex-col gap-4 px-4 py-6 sm:px-6">
        <FilterTabs pathname="/expiry" params={params} param="window" options={WINDOWS} value={window} />
        {rows.length === 0 ? (
          <EmptyState icon={CalendarCheck} title={window === "expired" ? "No expired stock on the shelf" : "Nothing expires in this window"}>
            {window === "expired" ? "Every expired batch has been written off." : "Choose a longer window to look further ahead."}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[52rem]">
              <caption className="sr-only">Batches by expiry</caption>
              <thead>
                <tr>
                  <th scope="col">Medicine</th>
                  <th scope="col">Batch</th>
                  <th scope="col">Expiry</th>
                  <th scope="col" className="text-right">In stock</th>
                  {isAdmin ? <th scope="col" className="text-right">Value at cost</th> : null}
                  <th scope="col">Supplier</th>
                  {isAdmin ? <th scope="col"><span className="sr-only">Actions</span></th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <Link href={`/medicines/${b.medicine.id}`} className="font-semibold text-[var(--color-primary)] hover:underline">{b.medicine.name} {b.medicine.strength}</Link>
                      {b.medicine.rack ? <p className="text-xs text-[var(--color-muted)]">Rack {b.medicine.rack}</p> : null}
                    </td>
                    <td className="font-mono">{b.batch_no}</td>
                    <td className="whitespace-nowrap">{formatExpiry(b.expiry_date)} <ExpiryBadge expiry={b.expiry_date} today={today} /></td>
                    <td className="num font-semibold">{formatUnits(b.qty_on_hand, b.medicine.units_per_pack)}</td>
                    {isAdmin ? <td className="num">{formatRs(b.qty_on_hand * Number(b.cost_per_unit))}</td> : null}
                    <td>{b.supplier?.name}</td>
                    {isAdmin ? (
                      <td className="text-right">
                        <AdjustStockDialog batch={b} medicine={b.medicine} defaultReason="expired" label="Write off" />
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager pathname="/expiry" params={params} page={page} count={count} noun="batches" />
      </div>
    </>
  );
}
