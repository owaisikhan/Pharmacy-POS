import Link from "next/link";
import { Pill, Plus } from "lucide-react";
import PageHeader from "@/app/_components/layout/PageHeader";
import UrlSearch from "@/app/_components/ui/UrlSearch";
import FilterTabs from "@/app/_components/ui/FilterTabs";
import Pager from "@/app/_components/ui/Pager";
import EmptyState from "@/app/_components/ui/EmptyState";
import { ExpiryBadge, StockBadge } from "@/app/_components/medicines/StockBadges";
import { listMedicines } from "@/app/_lib/data-service";
import { requireUser } from "@/app/_lib/helpers";
import { pageNumber } from "@/app/_lib/url-helpers";
import { todayPK } from "@/app/_lib/date-helpers";
import { formatCount, formatExpiry, formatRs, formatUnits } from "@/app/_lib/format-helpers";

export const metadata = { title: "Medicines" };

const FILTERS = [
  { value: "all", label: "All" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
  { value: "expired", label: "Has expired stock" },
  { value: "retired", label: "Retired" },
];

export default async function MedicinesPage({ searchParams }) {
  const { isAdmin } = await requireUser();
  const sp = await searchParams;
  const filter = FILTERS.some((f) => f.value === sp.filter) ? sp.filter : "all";
  const page = pageNumber(sp.page);
  const { rows, count } = await listMedicines({ q: sp.q, filter, page });
  const params = { q: sp.q, filter: sp.filter, page: sp.page };
  const today = todayPK();

  return (
    <>
      <PageHeader
        title="Medicines"
        description="Stock shown is what can be sold: expired batches are not counted."
        actions={
          isAdmin ? (
            <Link href="/medicines/new" className="btn btn-primary">
              <Plus className="h-4 w-4" aria-hidden /> Add medicine
            </Link>
          ) : null
        }
      />
      <div className="flex flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <UrlSearch placeholder="Name, generic, company or barcode" label="Search medicines" />
          <FilterTabs pathname="/medicines" params={params} options={FILTERS} value={filter} />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Pill} title={sp.q ? "No medicine matches" : "No medicines here"}>
            {sp.q ? "Try the generic name or the company." : isAdmin ? "Add medicines one by one, or they are created as you record purchases." : "The owner adds medicines."}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[56rem]">
              <caption className="sr-only">Medicines</caption>
              <thead>
                <tr>
                  <th scope="col">Medicine</th>
                  <th scope="col">Company</th>
                  <th scope="col">Rack</th>
                  <th scope="col" className="text-right">Price / pack</th>
                  <th scope="col" className="text-right">In stock</th>
                  <th scope="col">Next expiry</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    <td>
                      <Link href={`/medicines/${m.id}`} className="font-semibold text-[var(--color-primary)] hover:underline">
                        {m.name} {m.strength}
                      </Link>
                      <p className="text-xs text-[var(--color-muted)]">
                        {[m.form, m.generic_name, m.units_per_pack > 1 ? `${m.units_per_pack} per pack` : null].filter(Boolean).join(" · ")}
                      </p>
                    </td>
                    <td>{m.company}</td>
                    <td>{m.rack}</td>
                    <td className="num">{formatRs(m.sale_price_per_pack)}</td>
                    <td className="num font-semibold">{formatUnits(m.sellable_units, m.units_per_pack)}</td>
                    <td className="whitespace-nowrap">
                      {m.next_expiry ? formatExpiry(m.next_expiry) : ""} <ExpiryBadge expiry={m.next_expiry} today={today} />
                    </td>
                    <td className="whitespace-nowrap">
                      <StockBadge medicine={m} />
                      {m.expired_units > 0 ? <span className="ml-1 text-xs font-semibold text-[var(--color-danger)]">{formatUnits(m.expired_units, m.units_per_pack)} expired</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager pathname="/medicines" params={params} page={page} count={count} noun="medicines" />
        {count > 0 ? <p className="sr-only">{formatCount(count)} medicines</p> : null}
      </div>
    </>
  );
}
