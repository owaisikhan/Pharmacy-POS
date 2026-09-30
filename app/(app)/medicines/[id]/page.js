import { notFound } from "next/navigation";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";
import PageHeader from "@/app/_components/layout/PageHeader";
import MedicineForm from "@/app/_components/medicines/MedicineForm";
import AdjustStockDialog from "@/app/_components/medicines/AdjustStockDialog";
import RetireButton from "@/app/_components/medicines/RetireButton";
import { ExpiryBadge, StockBadge } from "@/app/_components/medicines/StockBadges";
import StatCard from "@/app/_components/ui/StatCard";
import { getMedicine, getMedicineBatches, getMedicineMovements, listCategories } from "@/app/_lib/data-service";
import { requireUser } from "@/app/_lib/helpers";
import { todayPK } from "@/app/_lib/date-helpers";
import { formatDateTime, formatExpiry, formatRs, formatUnits, unitPrice } from "@/app/_lib/format-helpers";

const REASON_LABEL = { purchase: "Purchase", sale: "Sale", return: "Customer return", damaged: "Damaged", expired: "Expired write-off", count: "Stock count", other: "Other" };

export async function generateMetadata({ params }) {
  const { id } = await params;
  return { title: `Medicine ${id}` };
}

export default async function MedicinePage({ params }) {
  const { isAdmin } = await requireUser();
  const { id } = await params;
  const medicine = await getMedicine(Number(id));
  if (!medicine) notFound();
  const [batches, movements, lists] = await Promise.all([
    getMedicineBatches(medicine.id, isAdmin),
    getMedicineMovements(medicine.id),
    isAdmin ? listCategories() : Promise.resolve(null),
  ]);
  const today = todayPK();
  const inStock = batches.filter((b) => b.qty_on_hand > 0);
  const empty = batches.filter((b) => b.qty_on_hand === 0);

  return (
    <>
      <PageHeader
        title={`${medicine.name} ${medicine.strength}`}
        description={[medicine.form, medicine.generic_name, medicine.company].filter(Boolean).join(" · ")}
        actions={isAdmin ? <RetireButton medicine={medicine} /> : null}
      >
        <div className="flex gap-2"><StockBadge medicine={medicine} /></div>
      </PageHeader>
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Can be sold" value={formatUnits(medicine.sellable_units, medicine.units_per_pack)} note={`Reorder at ${formatUnits(medicine.reorder_level, medicine.units_per_pack)}`} tone={medicine.sellable_units === 0 ? "bad" : undefined} />
          <StatCard label="Price per pack" value={formatRs(medicine.sale_price_per_pack)} note={medicine.units_per_pack > 1 ? `${formatRs(unitPrice(medicine.sale_price_per_pack, medicine.units_per_pack))} each loose${medicine.allow_loose ? "" : " (loose sale off)"}` : "Sold each"} />
          <StatCard label="Next expiry" value={medicine.next_expiry ? formatExpiry(medicine.next_expiry) : "None"} note="Earliest batch in stock, sold first" />
          <StatCard label="Expired on shelf" value={formatUnits(medicine.expired_units, medicine.units_per_pack)} note="Cannot be sold. Write it off below." tone={medicine.expired_units > 0 ? "bad" : undefined} />
        </div>

        <section>
          <h2 className="mb-2 text-base font-semibold">Batches</h2>
          {batches.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No batches yet. Stock arrives by recording a purchase.</p>
          ) : (
            <div className="table-wrap">
              <table className="table min-w-[44rem]">
                <caption className="sr-only">Batches of {medicine.name}</caption>
                <thead>
                  <tr>
                    <th scope="col">Batch</th>
                    <th scope="col">Expiry</th>
                    <th scope="col" className="text-right">In stock</th>
                    {isAdmin ? <th scope="col" className="text-right">Cost / pack</th> : null}
                    <th scope="col">Supplier</th>
                    {isAdmin ? <th scope="col"><span className="sr-only">Actions</span></th> : null}
                  </tr>
                </thead>
                <tbody>
                  {[...inStock, ...empty].map((b) => (
                    <tr key={b.id} className={b.qty_on_hand === 0 ? "text-[var(--color-muted)]" : undefined}>
                      <td className="font-mono font-semibold">{b.batch_no}</td>
                      <td className="whitespace-nowrap">{formatExpiry(b.expiry_date)} {b.qty_on_hand > 0 ? <ExpiryBadge expiry={b.expiry_date} today={today} /> : null}</td>
                      <td className="num font-semibold">{formatUnits(b.qty_on_hand, medicine.units_per_pack)}</td>
                      {isAdmin ? <td className="num">{formatRs(Number(b.cost_per_unit) * medicine.units_per_pack)}</td> : null}
                      <td>{b.supplier?.name}</td>
                      {isAdmin ? (
                        <td className="text-right">
                          {b.expiry_date < today && b.qty_on_hand > 0 ? (
                            <AdjustStockDialog batch={b} medicine={medicine} defaultReason="expired" label="Write off" />
                          ) : (
                            <AdjustStockDialog batch={b} medicine={medicine} />
                          )}
                        </td>
                      ) : null}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-2 text-base font-semibold">Recent stock movements</h2>
          {movements.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">Nothing has moved yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="table min-w-[40rem]">
                <caption className="sr-only">Stock movements</caption>
                <thead>
                  <tr>
                    <th scope="col">When</th>
                    <th scope="col">What</th>
                    <th scope="col">Batch</th>
                    <th scope="col" className="text-right">Change</th>
                    <th scope="col">By</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => {
                    const In = m.change_units > 0;
                    const Icon = In ? ArrowDownLeft : ArrowUpRight;
                    return (
                      <tr key={m.id}>
                        <td className="whitespace-nowrap">{formatDateTime(m.created_at)}</td>
                        <td>
                          {REASON_LABEL[m.reason]}
                          {m.note ? <span className="text-[var(--color-muted)]">: {m.note}</span> : null}
                        </td>
                        <td className="font-mono">{m.batch?.batch_no}</td>
                        <td className={`num font-semibold ${In ? "text-[var(--color-primary)]" : ""}`}>
                          <span className="inline-flex items-center gap-1">
                            <Icon className="h-3.5 w-3.5" aria-hidden />
                            {In ? "In" : "Out"} {formatUnits(Math.abs(m.change_units), medicine.units_per_pack)}
                          </span>
                        </td>
                        <td>{m.by?.full_name}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {isAdmin ? (
          <section>
            <h2 className="mb-2 text-base font-semibold">Details</h2>
            <div className="card max-w-5xl p-5">
              <MedicineForm medicine={medicine} categories={lists.categories} companies={lists.companies} />
            </div>
          </section>
        ) : null}
      </div>
    </>
  );
}
