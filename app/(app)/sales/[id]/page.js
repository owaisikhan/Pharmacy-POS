import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/app/_components/layout/PageHeader";
import ReturnDialog from "@/app/_components/sales/ReturnDialog";
import ReprintButton from "@/app/_components/sales/ReprintButton";
import Badge from "@/app/_components/ui/Badge";
import { getSale } from "@/app/_lib/data-service";
import { requireUser } from "@/app/_lib/helpers";
import { formatDateTime, formatExpiry, formatRs, formatUnits } from "@/app/_lib/format-helpers";

export async function generateMetadata({ params }) {
  const { id } = await params;
  return { title: `Bill ${id}` };
}

export default async function SalePage({ params }) {
  await requireUser();
  const { id } = await params;
  const sale = await getSale(Number(id));
  if (!sale) notFound();
  const refunded = sale.returns.reduce((s, r) => s + Number(r.refund_amount), 0);

  return (
    <>
      <PageHeader
        title={`Bill ${sale.invoice_no}`}
        description={`${formatDateTime(sale.created_at)}, by ${sale.cashier?.full_name || "unknown"}${sale.customer ? `, for ${sale.customer.name}` : ""}.`}
        actions={
          <>
            <ReturnDialog sale={sale} />
            <ReprintButton saleId={sale.id} />
          </>
        }
      />
      <div className="grid grid-cols-1 gap-4 px-4 py-6 sm:px-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="table-wrap self-start">
          <table className="table min-w-[44rem]">
            <caption className="sr-only">Medicines on this bill</caption>
            <thead>
              <tr>
                <th scope="col">Medicine</th>
                <th scope="col">Batches</th>
                <th scope="col" className="text-right">Qty</th>
                <th scope="col" className="text-right">Price</th>
                <th scope="col" className="text-right">Discount</th>
                <th scope="col" className="text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {sale.sale_lines.map((l) => {
                const returned = l.sale_line_batches.reduce((s, b) => s + b.qty_returned, 0);
                return (
                  <tr key={l.id}>
                    <td>
                      <Link href={`/medicines/${l.medicine.id}`} className="font-semibold hover:underline">{l.medicine.name} {l.medicine.strength}</Link>
                      {returned > 0 ? <p><Badge tone="warn">{formatUnits(returned, l.medicine.units_per_pack)} returned</Badge></p> : null}
                    </td>
                    <td className="text-xs text-[var(--color-muted)]">
                      {l.sale_line_batches.map((b, i) => (
                        <p key={i} className="whitespace-nowrap">
                          {b.batch.batch_no}, exp {formatExpiry(b.batch.expiry_date)}: {formatUnits(b.qty_units, l.medicine.units_per_pack)}
                        </p>
                      ))}
                    </td>
                    <td className="num">
                      {l.qty} {l.sale_unit === "pack" ? (l.medicine.units_per_pack > 1 ? (l.qty === 1 ? "pack" : "packs") : "") : "loose"}
                    </td>
                    <td className="num">{formatRs(l.unit_price)}</td>
                    <td className="num">{Number(l.discount_amount) > 0 ? `${formatRs(l.discount_amount)} (${Number(l.discount_percent)}%)` : "None"}</td>
                    <td className="num font-semibold">{formatRs(l.line_total)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4">
          <div className="card p-4">
            <dl className="flex flex-col gap-1.5 text-sm">
              <Row label="Subtotal" value={formatRs(sale.subtotal)} />
              {Number(sale.bill_discount) > 0 ? <Row label="Bill discount" value={formatRs(sale.bill_discount)} /> : null}
              <div className="mt-1 flex items-baseline justify-between border-t border-[var(--color-border)] pt-2">
                <dt className="font-semibold">Total</dt>
                <dd className="num text-xl font-bold">{formatRs(sale.total)}</dd>
              </div>
              {Number(sale.cash_amount) > 0 ? <Row label="Cash" value={formatRs(sale.cash_amount)} /> : null}
              {Number(sale.tendered) > 0 ? <Row label="Cash received / change" value={`${formatRs(sale.tendered)} / ${formatRs(sale.change_due)}`} /> : null}
              {Number(sale.card_amount) > 0 ? <Row label="Card" value={formatRs(sale.card_amount)} /> : null}
              {Number(sale.credit_amount) > 0 ? <Row label="On account" value={formatRs(sale.credit_amount)} /> : null}
              {refunded > 0 ? <Row label="Refunded" value={formatRs(refunded)} /> : null}
            </dl>
            {sale.note ? <p className="mt-3 rounded-lg bg-[var(--color-surface-2)] px-3 py-2 text-sm">Note: {sale.note}</p> : null}
          </div>

          {sale.returns.length > 0 ? (
            <div className="card p-4">
              <h2 className="mb-2 text-base font-semibold">Returns</h2>
              <ul className="flex flex-col divide-y divide-[var(--color-border-soft)] text-sm">
                {sale.returns.map((r) => (
                  <li key={r.id} className="py-2">
                    <div className="flex justify-between gap-2">
                      <span className="font-mono font-semibold">{r.return_no}</span>
                      <span className="num font-semibold">{formatRs(r.refund_amount)}</span>
                    </div>
                    <p className="text-xs text-[var(--color-muted)]">
                      {formatDateTime(r.created_at)}, {r.refund_method === "cash" ? "cash" : "to account"}, by {r.by?.full_name}
                      {r.note ? `. ${r.note}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-[var(--color-muted)]">{label}</dt>
      <dd className="num">{value}</dd>
    </div>
  );
}
