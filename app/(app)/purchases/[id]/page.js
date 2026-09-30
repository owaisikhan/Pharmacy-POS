import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/app/_components/layout/PageHeader";
import { getPurchase } from "@/app/_lib/data-service";
import { requireAdmin } from "@/app/_lib/helpers";
import { formatDateTime, formatDay, formatExpiry, formatRs } from "@/app/_lib/format-helpers";

export const metadata = { title: "Purchase" };

export default async function PurchasePage({ params }) {
  await requireAdmin();
  const { id } = await params;
  const p = await getPurchase(Number(id));
  if (!p) notFound();
  return (
    <>
      <PageHeader
        title={`Purchase from ${p.supplier.name}`}
        description={`Invoice ${p.supplier_invoice_no || `#${p.id}`}, dated ${formatDay(p.purchase_date)}. Saved ${formatDateTime(p.created_at)} by ${p.by?.full_name}.`}
        actions={<Link href={`/suppliers/${p.supplier.id}`} className="btn btn-secondary">Supplier account</Link>}
      />
      <div className="grid grid-cols-1 gap-4 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="table-wrap self-start">
          <table className="table min-w-[52rem]">
            <caption className="sr-only">Lines</caption>
            <thead>
              <tr>
                <th scope="col">Medicine</th>
                <th scope="col">Batch</th>
                <th scope="col">Expiry</th>
                <th scope="col" className="text-right">Packs</th>
                <th scope="col" className="text-right">Bonus</th>
                <th scope="col" className="text-right">Cost / pack</th>
                <th scope="col" className="text-right">Sale price</th>
                <th scope="col" className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {p.purchase_lines.map((l) => (
                <tr key={l.id}>
                  <td><Link href={`/medicines/${l.medicine.id}`} className="font-semibold hover:underline">{l.medicine.name} {l.medicine.strength}</Link></td>
                  <td className="font-mono">{l.batch_no}</td>
                  <td>{formatExpiry(l.expiry_date)}</td>
                  <td className="num">{l.packs}</td>
                  <td className="num">{l.bonus_packs || ""}</td>
                  <td className="num">{formatRs(l.cost_per_pack)}</td>
                  <td className="num">{Number(l.sale_price_per_pack) > 0 ? formatRs(l.sale_price_per_pack) : "Unchanged"}</td>
                  <td className="num font-semibold">{formatRs(l.line_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="card self-start p-4 text-sm">
          <dl className="flex flex-col gap-1.5">
            <div className="flex justify-between"><dt className="text-[var(--color-muted)]">Invoice amount</dt><dd className="num">{formatRs(p.subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--color-muted)]">Discount</dt><dd className="num">{formatRs(p.discount)}</dd></div>
            <div className="flex items-baseline justify-between border-t border-[var(--color-border)] pt-2"><dt className="font-semibold">Total</dt><dd className="num text-xl font-bold">{formatRs(p.total)}</dd></div>
            <div className="flex justify-between"><dt className="text-[var(--color-muted)]">Paid with the invoice</dt><dd className="num">{formatRs(p.paid_amount)}</dd></div>
          </dl>
          {p.note ? <p className="mt-3 rounded-lg bg-[var(--color-surface-2)] px-3 py-2">Note: {p.note}</p> : null}
        </div>
      </div>
    </>
  );
}
