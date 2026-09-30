import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";
import PageHeader from "@/app/_components/layout/PageHeader";
import SupplierDialog from "@/app/_components/suppliers/SupplierDialog";
import PaySupplierDialog from "@/app/_components/suppliers/PaySupplierDialog";
import BalanceEntryDialog from "@/app/_components/ui/BalanceEntryDialog";
import Balance from "@/app/_components/ui/Balance";
import StatCard from "@/app/_components/ui/StatCard";
import { adjustSupplierBalance } from "@/app/_lib/actions";
import { getSupplier, getSupplierLedger } from "@/app/_lib/data-service";
import { requireAdmin } from "@/app/_lib/helpers";
import { formatDateTime, formatRs } from "@/app/_lib/format-helpers";

const KIND = { purchase: "Purchase invoice", payment: "Payment made", opening: "Opening balance", adjustment: "Correction" };

export const metadata = { title: "Supplier" };

export default async function SupplierPage({ params }) {
  await requireAdmin();
  const { id } = await params;
  const supplier = await getSupplier(Number(id));
  if (!supplier) notFound();
  const ledger = await getSupplierLedger(supplier.id);
  const balance = Number(supplier.balance);

  return (
    <>
      <PageHeader
        title={supplier.name}
        description={[supplier.phone, supplier.address, supplier.notes].filter(Boolean).join(" · ") || "No contact details"}
        actions={
          <>
            <SupplierDialog supplier={supplier} />
            <BalanceEntryDialog
              action={adjustSupplierBalance}
              idName="supplier_id"
              id={supplier.id}
              name={supplier.name}
              directions={[
                { value: "bill", label: "We owe the supplier more" },
                { value: "payment", label: "We owe the supplier less" },
              ]}
            />
            <Link href="/purchases/new" className="btn btn-secondary"><Plus className="h-4 w-4" aria-hidden /> Purchase</Link>
            <PaySupplierDialog supplier={supplier} />
          </>
        }
      />
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <StatCard label={balance > 0 ? "We owe" : balance < 0 ? "Paid ahead" : "Balance"} value={balance ? formatRs(balance) : "Settled"} note="Now, after every entry below" />
          <StatCard label="Entries" value={ledger.length} note="Invoices and payments" />
        </div>
        {ledger.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No entries yet.</p>
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[46rem]">
              <caption className="sr-only">Account with {supplier.name}</caption>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Entry</th>
                  <th scope="col" className="text-right">Invoice</th>
                  <th scope="col" className="text-right">Paid</th>
                  <th scope="col" className="text-right">Balance after</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                    <td>
                      {r.purchase_id && r.kind === "purchase" ? <Link href={`/purchases/${r.purchase_id}`} className="text-[var(--color-primary)] hover:underline">{KIND[r.kind]}</Link> : KIND[r.kind]}
                      {r.method ? ` (${r.method})` : ""}
                      {r.note ? <span className="text-[var(--color-muted)]"> · {r.note}</span> : null}
                    </td>
                    <td className="num">{Number(r.bill) > 0 ? formatRs(r.bill) : ""}</td>
                    <td className="num">{Number(r.payment) > 0 ? formatRs(r.payment) : ""}</td>
                    <td className="num"><Balance value={r.balance} owesWord="We owe" strong={false} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
