import Link from "next/link";
import { ReceiptText } from "lucide-react";
import PageHeader from "@/app/_components/layout/PageHeader";
import UrlSearch from "@/app/_components/ui/UrlSearch";
import DayPicker from "@/app/_components/ui/DayPicker";
import Pager from "@/app/_components/ui/Pager";
import EmptyState from "@/app/_components/ui/EmptyState";
import Badge from "@/app/_components/ui/Badge";
import { listSales } from "@/app/_lib/data-service";
import { requireUser } from "@/app/_lib/helpers";
import { isIsoDate, todayPK } from "@/app/_lib/date-helpers";
import { pageNumber } from "@/app/_lib/url-helpers";
import { formatCount, formatDate, formatDay, formatRs, formatTime } from "@/app/_lib/format-helpers";

export const metadata = { title: "Bills and returns" };

function paidBy(s) {
  const parts = [];
  if (Number(s.cash_amount) > 0) parts.push("Cash");
  if (Number(s.card_amount) > 0) parts.push("Card");
  if (Number(s.credit_amount) > 0) parts.push("Account");
  return parts.join(" + ") || "Cash";
}

export default async function SalesPage({ searchParams }) {
  await requireUser();
  const sp = await searchParams;
  const date = isIsoDate(sp.date) ? sp.date : todayPK();
  const q = sp.q || "";
  const page = pageNumber(sp.page);
  const { rows, count } = await listSales({ date, q, page });
  const params = { date: sp.date, q, page: sp.page };
  const dayTotal = rows.reduce((s, r) => s + Number(r.total), 0);

  return (
    <>
      <PageHeader title="Bills and returns" description="Find a bill to reprint it or take a return." />
      <div className="flex flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <UrlSearch placeholder="Bill number, e.g. INV-000123" label="Search bills" />
          {q ? null : <DayPicker value={date} />}
        </div>
        <p className="text-sm text-[var(--color-muted)]">
          {q ? `Bills matching "${q}", any day.` : `${formatDay(date)}: ${formatCount(count)} bill${count === 1 ? "" : "s"}${count > 0 && count <= 25 ? `, ${formatRs(dayTotal)}` : ""}.`}
        </p>
        {rows.length === 0 ? (
          <EmptyState icon={ReceiptText} title={q ? "No bill matches" : "No bills on this day"}>
            {q ? "Check the number on the receipt." : "Choose another day, or search by bill number."}
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[48rem]">
              <caption className="sr-only">Bills</caption>
              <thead>
                <tr>
                  <th scope="col">Bill</th>
                  <th scope="col">Time</th>
                  <th scope="col">Customer</th>
                  <th scope="col">Cashier</th>
                  <th scope="col" className="text-right">Items</th>
                  <th scope="col">Paid by</th>
                  <th scope="col" className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const refunded = r.returns.reduce((s, x) => s + Number(x.refund_amount), 0);
                  return (
                    <tr key={r.id}>
                      <td>
                        <Link href={`/sales/${r.id}`} className="font-mono font-semibold text-[var(--color-primary)] hover:underline">{r.invoice_no}</Link>
                      </td>
                      <td className="whitespace-nowrap">{q ? `${formatDate(r.created_at)}, ` : ""}{formatTime(r.created_at)}</td>
                      <td>{r.customer ? <Link className="hover:underline" href={`/customers/${r.customer.id}`}>{r.customer.name}</Link> : <span className="text-[var(--color-muted)]">Walk-in</span>}</td>
                      <td>{r.cashier?.full_name}</td>
                      <td className="num">{r.sale_lines[0]?.count ?? 0}</td>
                      <td>
                        {paidBy(r)}
                        {refunded > 0 ? <Badge tone="warn" className="ml-2">Returned {formatRs(refunded)}</Badge> : null}
                      </td>
                      <td className="num font-semibold">{formatRs(r.total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager pathname="/sales" params={params} page={page} count={count} noun="bills" />
      </div>
    </>
  );
}
