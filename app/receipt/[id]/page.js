import Link from "next/link";
import { notFound } from "next/navigation";
import AutoPrint from "@/app/_components/pos/AutoPrint";
import PrintButton from "@/app/_components/pos/PrintButton";
import { getSale, getSettings } from "@/app/_lib/data-service";
import { requireUser } from "@/app/_lib/helpers";
import { formatDateTime, formatRs } from "@/app/_lib/format-helpers";

export const metadata = { title: "Receipt" };

// An 80mm thermal receipt (72mm printable). Plain black on white, monospaced
// figures, no colour: thermal printers print one shade.
export default async function ReceiptPage({ params, searchParams }) {
  await requireUser();
  const { id } = await params;
  const { print } = await searchParams;
  const [sale, settings] = await Promise.all([getSale(Number(id)), getSettings()]);
  if (!sale) notFound();

  const refunded = sale.returns.reduce((s, r) => s + Number(r.refund_amount), 0);
  const row = "flex justify-between gap-2";

  return (
    <div className="min-h-dvh bg-white text-black print:min-h-0">
      <div className="no-print flex items-center justify-between gap-2 border-b p-3">
        <Link href={`/sales/${sale.id}`} className="btn btn-secondary btn-sm">Back to bill</Link>
        <PrintButton />
      </div>
      <div className="mx-auto w-[72mm] px-[2mm] py-[4mm] font-mono text-[11px] leading-snug">
        <div className="text-center">
          <p className="text-[14px] font-bold">{settings?.pharmacy_name}</p>
          {settings?.address ? <p>{settings.address}</p> : null}
          {settings?.phone ? <p>Tel {settings.phone}</p> : null}
          {settings?.licence_no ? <p>Licence {settings.licence_no}</p> : null}
        </div>
        <div className="my-2 border-t border-dashed border-black" />
        <div className={row}><span>Bill</span><span>{sale.invoice_no}</span></div>
        <div className={row}><span>Date</span><span>{formatDateTime(sale.created_at)}</span></div>
        <div className={row}><span>Cashier</span><span>{sale.cashier?.full_name}</span></div>
        {sale.customer ? <div className={row}><span>Customer</span><span className="text-right">{sale.customer.name}</span></div> : null}
        <div className="my-2 border-t border-dashed border-black" />
        {sale.sale_lines.map((l) => (
          <div key={l.id} className="mb-1">
            <p className="font-bold">{l.medicine.name} {l.medicine.strength}</p>
            <div className={row}>
              <span>
                {l.qty} {l.sale_unit === "pack" ? (l.medicine.units_per_pack > 1 ? (l.qty === 1 ? "pack" : "packs") : "x") : "loose"} @ {formatRs(l.unit_price).replace("Rs ", "")}
                {Number(l.discount_percent) > 0 ? ` -${Number(l.discount_percent)}%` : ""}
              </span>
              <span className="whitespace-nowrap">{formatRs(l.line_total).replace("Rs ", "")}</span>
            </div>
          </div>
        ))}
        <div className="my-2 border-t border-dashed border-black" />
        <div className={row}><span>Subtotal</span><span>{formatRs(sale.subtotal)}</span></div>
        {Number(sale.bill_discount) > 0 ? <div className={row}><span>Discount</span><span>{formatRs(sale.bill_discount)}</span></div> : null}
        <div className={`${row} text-[14px] font-bold`}><span>TOTAL</span><span>{formatRs(sale.total)}</span></div>
        <div className="my-1" />
        {Number(sale.cash_amount) > 0 || Number(sale.tendered) > 0 ? (
          <>
            <div className={row}><span>Cash received</span><span>{formatRs(sale.tendered)}</span></div>
            <div className={row}><span>Change</span><span>{formatRs(sale.change_due)}</span></div>
          </>
        ) : null}
        {Number(sale.card_amount) > 0 ? <div className={row}><span>Card</span><span>{formatRs(sale.card_amount)}</span></div> : null}
        {Number(sale.credit_amount) > 0 ? <div className={row}><span>On account</span><span>{formatRs(sale.credit_amount)}</span></div> : null}
        {refunded > 0 ? <div className={row}><span>Returned</span><span>{formatRs(refunded)}</span></div> : null}
        {sale.note ? <p className="mt-2">Note: {sale.note}</p> : null}
        <div className="my-2 border-t border-dashed border-black" />
        <p className="text-center">{settings?.receipt_footer}</p>
        <p className="mt-2 text-center text-[10px]">Items: {sale.sale_lines.length}</p>
      </div>
      {print ? <AutoPrint /> : null}
    </div>
  );
}
