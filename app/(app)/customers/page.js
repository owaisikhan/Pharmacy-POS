import Link from "next/link";
import { Users } from "lucide-react";
import PageHeader from "@/app/_components/layout/PageHeader";
import UrlSearch from "@/app/_components/ui/UrlSearch";
import FilterTabs from "@/app/_components/ui/FilterTabs";
import Pager from "@/app/_components/ui/Pager";
import EmptyState from "@/app/_components/ui/EmptyState";
import CustomerDialog from "@/app/_components/customers/CustomerDialog";
import Balance from "@/app/_components/ui/Balance";
import { listCustomers } from "@/app/_lib/data-service";
import { requireUser } from "@/app/_lib/helpers";
import { pageNumber } from "@/app/_lib/url-helpers";
import { formatRs } from "@/app/_lib/format-helpers";

export const metadata = { title: "Customers" };

const FILTERS = [
  { value: "all", label: "All" },
  { value: "owing", label: "Owe money" },
  { value: "retired", label: "Retired" },
];

export default async function CustomersPage({ searchParams }) {
  const { isAdmin } = await requireUser();
  const sp = await searchParams;
  const filter = FILTERS.some((f) => f.value === sp.filter) ? sp.filter : "all";
  const page = pageNumber(sp.page);
  const { rows, count } = await listCustomers({ q: sp.q, filter, page });
  const params = { q: sp.q, filter: sp.filter, page: sp.page };

  return (
    <>
      <PageHeader title="Customers" description="Regular customers and their credit accounts (khata)." actions={<CustomerDialog isAdmin={isAdmin} />} />
      <div className="flex flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <UrlSearch placeholder="Name or phone" label="Search customers" />
          <FilterTabs pathname="/customers" params={params} options={FILTERS} value={filter} />
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={Users} title={sp.q ? "No customer matches" : "No customers here"}>
            Customers can also be added from the sale screen.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[40rem]">
              <caption className="sr-only">Customers</caption>
              <thead>
                <tr>
                  <th scope="col">Customer</th>
                  <th scope="col">Phone</th>
                  <th scope="col" className="text-right">Credit limit</th>
                  <th scope="col" className="text-right">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/customers/${c.id}`} className="font-semibold text-[var(--color-primary)] hover:underline">{c.name}</Link>
                      {c.address ? <p className="text-xs text-[var(--color-muted)]">{c.address}</p> : null}
                    </td>
                    <td className="whitespace-nowrap">{c.phone}</td>
                    <td className="num">{Number(c.credit_limit) > 0 ? formatRs(c.credit_limit) : "No limit"}</td>
                    <td className="num"><Balance value={c.balance} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager pathname="/customers" params={params} page={page} count={count} noun="customers" />
      </div>
    </>
  );
}
