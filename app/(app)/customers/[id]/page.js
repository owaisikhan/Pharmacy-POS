import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/app/_components/layout/PageHeader";
import CustomerDialog from "@/app/_components/customers/CustomerDialog";
import ReceivePaymentDialog from "@/app/_components/customers/ReceivePaymentDialog";
import BalanceEntryDialog from "@/app/_components/ui/BalanceEntryDialog";
import Balance from "@/app/_components/ui/Balance";
import StatCard from "@/app/_components/ui/StatCard";
import { adjustCustomerBalance } from "@/app/_lib/actions";
import { getCustomer, getCustomerLedger } from "@/app/_lib/data-service";
import { requireUser } from "@/app/_lib/helpers";
import { formatDateTime, formatRs } from "@/app/_lib/format-helpers";

const KIND = { sale: "Sale on account", payment: "Payment received", return: "Return credited", opening: "Opening balance", adjustment: "Correction" };

export async function generateMetadata({ params }) {
  const { id } = await params;
  return { title: `Customer ${id}` };
}

export default async function CustomerPage({ params }) {
  const { isAdmin } = await requireUser();
  const { id } = await params;
  const customer = await getCustomer(Number(id));
  if (!customer) notFound();
  const ledger = await getCustomerLedger(customer.id);
  const balance = Number(customer.balance);

  return (
    <>
      <PageHeader
        title={customer.name}
        description={[customer.phone, customer.address, customer.active ? null : "Retired"].filter(Boolean).join(" · ") || "No contact details"}
        actions={
          <>
            <CustomerDialog customer={customer} isAdmin={isAdmin} />
            {isAdmin ? (
              <BalanceEntryDialog
                action={adjustCustomerBalance}
                idName="customer_id"
                id={customer.id}
                name={customer.name}
                directions={[
                  { value: "charge", label: "They owe the pharmacy more" },
                  { value: "payment", label: "They owe the pharmacy less" },
                ]}
              />
            ) : null}
            <ReceivePaymentDialog customer={customer} />
          </>
        }
      />
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-6">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label={balance > 0 ? "Owes the pharmacy" : balance < 0 ? "Paid ahead" : "Balance"} value={balance ? formatRs(balance) : "Settled"} note="Now, after every entry below" />
          <StatCard label="Credit limit" value={Number(customer.credit_limit) > 0 ? formatRs(customer.credit_limit) : "No limit"} note={isAdmin ? "Change it with Edit" : "Set by the owner"} />
          <StatCard label="Entries" value={ledger.length} note={customer.notes || "Sales on account, payments and returns"} />
        </div>
        {ledger.length === 0 ? (
          <p className="text-sm text-[var(--color-muted)]">No account entries yet. Sell on account from the sale screen, or add an opening balance.</p>
        ) : (
          <div className="table-wrap">
            <table className="table min-w-[46rem]">
              <caption className="sr-only">Account of {customer.name}</caption>
              <thead>
                <tr>
                  <th scope="col">When</th>
                  <th scope="col">Entry</th>
                  <th scope="col" className="text-right">Charged</th>
                  <th scope="col" className="text-right">Paid</th>
                  <th scope="col" className="text-right">Balance after</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{formatDateTime(r.created_at)}</td>
                    <td>
                      {KIND[r.kind]}
                      {r.method ? ` (${r.method})` : ""}
                      {r.sale ? <> · <Link href={`/sales/${r.sale.id}`} className="font-mono text-[var(--color-primary)] hover:underline">{r.sale.invoice_no}</Link></> : null}
                      {r.note && !r.sale ? <span className="text-[var(--color-muted)]"> · {r.note}</span> : null}
                      <p className="text-xs text-[var(--color-muted)]">by {r.by?.full_name}</p>
                    </td>
                    <td className="num">{Number(r.charge) > 0 ? formatRs(r.charge) : ""}</td>
                    <td className="num">{Number(r.payment) > 0 ? formatRs(r.payment) : ""}</td>
                    <td className="num"><Balance value={r.balance} strong={false} /></td>
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
