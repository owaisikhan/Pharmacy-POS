import Link from "next/link";
import { PackagePlus, Plus } from "lucide-react";
import PageHeader from "@/app/_components/layout/PageHeader";
import Pager from "@/app/_components/ui/Pager";
import EmptyState from "@/app/_components/ui/EmptyState";
import { listPurchases } from "@/app/_lib/data-service";
import { requireAdmin } from "@/app/_lib/helpers";
import { pageNumber } from "@/app/_lib/url-helpers";
import { formatDay, formatRs } from "@/app/_lib/format-helpers";

export const metadata = { title: "Purchases" };

export default async function PurchasesPage({ searchParams }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = pageNumber(sp.page);
  const { rows, count } = await listPurchases({ page });
  return (
    <>
      <PageHeader
        title="Purchases"
        description="Stock received from suppliers, newest first."
        actions={<Link href="/purchases/new" className="btn btn-primary"><Plus className="h-4 w-4" aria-hidden /> Record purchase</Link>}
      />
      <div className="flex flex-col gap-4 px-4 py-6 sm:px-6">
        {rows.length === 0 ? (
          <EmptyState icon={PackagePlus} title="No purchases yet">Record the first supplier invoice to put stock on the shelf.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[44rem]">
              <caption className="sr-only">Purchases</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Supplier</th>
                  <th scope="col">Invoice</th>
                  <th scope="col" className="text-right">Lines</th>
                  <th scope="col" className="text-right">Total</th>
                  <th scope="col" className="text-right">Paid then</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap"><Link href={`/purchases/${p.id}`} className="font-semibold text-[var(--color-primary)] hover:underline">{formatDay(p.purchase_date)}</Link></td>
                    <td><Link href={`/suppliers/${p.supplier.id}`} className="hover:underline">{p.supplier.name}</Link></td>
                    <td className="font-mono">{p.supplier_invoice_no || `#${p.id}`}</td>
                    <td className="num">{p.purchase_lines[0]?.count ?? 0}</td>
                    <td className="num font-semibold">{formatRs(p.total)}</td>
                    <td className="num">{formatRs(p.paid_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager pathname="/purchases" params={{ page: sp.page }} page={page} count={count} noun="purchases" />
      </div>
    </>
  );
}
