import Link from "next/link";
import { Truck } from "lucide-react";
import PageHeader from "@/app/_components/layout/PageHeader";
import UrlSearch from "@/app/_components/ui/UrlSearch";
import Pager from "@/app/_components/ui/Pager";
import EmptyState from "@/app/_components/ui/EmptyState";
import Balance from "@/app/_components/ui/Balance";
import SupplierDialog from "@/app/_components/suppliers/SupplierDialog";
import { listSuppliers } from "@/app/_lib/data-service";
import { requireAdmin } from "@/app/_lib/helpers";
import { pageNumber } from "@/app/_lib/url-helpers";

export const metadata = { title: "Suppliers" };

export default async function SuppliersPage({ searchParams }) {
  await requireAdmin();
  const sp = await searchParams;
  const page = pageNumber(sp.page);
  const { rows, count } = await listSuppliers({ q: sp.q, page });
  return (
    <>
      <PageHeader title="Suppliers" description="Distributors you buy from, and what you owe each." actions={<SupplierDialog />} />
      <div className="flex flex-col gap-4 px-4 py-6 sm:px-6">
        <UrlSearch placeholder="Supplier name" label="Search suppliers" />
        {rows.length === 0 ? (
          <EmptyState icon={Truck} title="No suppliers yet">Add the distributors you buy from before recording a purchase.</EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[36rem]">
              <caption className="sr-only">Suppliers</caption>
              <thead>
                <tr>
                  <th scope="col">Supplier</th>
                  <th scope="col">Phone</th>
                  <th scope="col" className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/suppliers/${s.id}`} className="font-semibold text-[var(--color-primary)] hover:underline">{s.name}</Link>
                      {!s.active ? <span className="ml-2 text-xs text-[var(--color-muted)]">Retired</span> : null}
                    </td>
                    <td>{s.phone}</td>
                    <td className="num"><Balance value={s.balance} owesWord="We owe" aheadWord="Paid ahead" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager pathname="/suppliers" params={{ q: sp.q, page: sp.page }} page={page} count={count} noun="suppliers" />
      </div>
    </>
  );
}
