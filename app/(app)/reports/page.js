import Link from "next/link";
import clsx from "clsx";
import PageHeader from "@/app/_components/layout/PageHeader";
import StatCard from "@/app/_components/ui/StatCard";
import RangePicker from "@/app/_components/reports/RangePicker";
import { getReport } from "@/app/_lib/data-service";
import { requireAdmin } from "@/app/_lib/helpers";
import { addDays, daysBetween, isIsoDate, startOfMonth, todayPK } from "@/app/_lib/date-helpers";
import { formatCount, formatDay, formatRs, formatUnits } from "@/app/_lib/format-helpers";

export const metadata = { title: "Reports" };

export default async function ReportsPage({ searchParams }) {
  await requireAdmin();
  const sp = await searchParams;
  const today = todayPK();
  let from = isIsoDate(sp.from) ? sp.from : startOfMonth(today);
  let to = isIsoDate(sp.to) ? sp.to : today;
  if (to > today) to = today;
  if (from > to) from = to;
  if (daysBetween(from, to) > 366) from = addDays(to, -366);

  const { summary: s, byDay, top, stock } = await getReport(from, to);
  const presets = [
    { label: "Today", from: today, to: today },
    { label: "Yesterday", from: addDays(today, -1), to: addDays(today, -1) },
    { label: "Last 7 days", from: addDays(today, -6), to: today },
    { label: "This month", from: startOfMonth(today), to: today },
    { label: "Last 30 days", from: addDays(today, -29), to: today },
  ];
  const maxDay = Math.max(1, ...byDay.map((d) => Number(d.net)));
  const margin = Number(s.net_sales) - Number(s.tax) > 0 ? (Number(s.profit) / (Number(s.net_sales) - Number(s.tax))) * 100 : 0;

  return (
    <>
      <PageHeader title="Reports" description={from === to ? formatDay(from) : `${formatDay(from)} to ${formatDay(to)}`} />
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="inline-flex flex-wrap gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] p-1">
            {presets.map((p) => {
              const active = p.from === from && p.to === to;
              const cls = clsx("rounded-md px-3 py-1.5 text-sm font-medium", active ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-muted)] hover:bg-[var(--color-surface-2)]");
              return active ? <span key={p.label} aria-current="true" className={cls}>{p.label}</span> : <Link key={p.label} scroll={false} href={`/reports?from=${p.from}&to=${p.to}`} className={cls}>{p.label}</Link>;
            })}
          </div>
          <RangePicker key={`${from}-${to}`} from={from} to={to} max={today} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Net sales" value={formatRs(s.net_sales)} note={`${formatCount(s.bills)} bills, less ${formatRs(s.returns)} returned`} />
          <StatCard label="Gross profit" value={formatRs(s.profit)} tone={Number(s.profit) < 0 ? "bad" : "good"} note={`${margin.toFixed(1)}% of sales before tax. Cost of medicines ${formatRs(s.cost)}`} />
          <StatCard label="Discounts given" value={formatRs(s.discounts)} note={Number(s.tax) > 0 ? `Tax collected ${formatRs(s.tax)}` : "Line and bill discounts"} />
          <StatCard label="Account payments received" value={formatRs(s.customer_payments)} note={`Sold on account ${formatRs(s.credit)}`} />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatCard label="Cash sales" value={formatRs(s.cash)} note="Before cash refunds" />
          <StatCard label="Card sales" value={formatRs(s.card)} note="Check against the card machine settlement" />
          <StatCard label="Stock value now" value={formatRs(stock.at_cost)} note={`At cost. At sale price ${formatRs(stock.at_sale_price)}. Expired on shelf ${formatRs(stock.expired_at_cost)}`} />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section>
            <h2 className="mb-2 text-base font-semibold">Sales by day</h2>
            <div className="table-wrap">
              <table className="table min-w-[32rem]">
                <caption className="sr-only">Sales by day</caption>
                <thead>
                  <tr>
                    <th scope="col">Day</th>
                    <th scope="col" className="text-right">Bills</th>
                    <th scope="col" className="text-right">Returns</th>
                    <th scope="col" className="text-right">Net sales</th>
                    <th scope="col" className="w-[30%]"><span className="sr-only">Share</span></th>
                  </tr>
                </thead>
                <tbody>
                  {byDay.map((d) => (
                    <tr key={d.day}>
                      <td className="whitespace-nowrap"><Link href={`/sales?date=${d.day}`} className="hover:underline">{formatDay(d.day)}</Link></td>
                      <td className="num">{d.bills}</td>
                      <td className="num">{Number(d.returns) > 0 ? formatRs(d.returns) : ""}</td>
                      <td className="num font-semibold">{formatRs(d.net)}</td>
                      <td aria-hidden>
                        <div className="h-2 rounded-full bg-[var(--color-surface-2)]">
                          <div className="h-2 rounded-full bg-[var(--color-primary)]" style={{ width: `${Math.max(0, (Number(d.net) / maxDay) * 100)}%` }} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h2 className="mb-2 text-base font-semibold">Top medicines by sales</h2>
            {top.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">Nothing sold in this period.</p>
            ) : (
              <div className="table-wrap">
                <table className="table min-w-[32rem]">
                  <caption className="sr-only">Top medicines</caption>
                  <thead>
                    <tr>
                      <th scope="col">Medicine</th>
                      <th scope="col" className="text-right">Sold</th>
                      <th scope="col" className="text-right">Sales</th>
                      <th scope="col" className="text-right">Profit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top.map((m) => (
                      <tr key={m.medicine_id}>
                        <td><Link href={`/medicines/${m.medicine_id}`} className="font-medium hover:underline">{m.name} {m.strength}</Link></td>
                        <td className="num">{formatUnits(Number(m.units_sold), m.units_per_pack)}</td>
                        <td className="num font-semibold">{formatRs(m.revenue)}</td>
                        <td className={clsx("num", Number(m.profit) < 0 && "text-[var(--color-danger)]")}>{Number(m.profit) < 0 ? "Loss " : ""}{formatRs(m.profit)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="mt-2 text-xs text-[var(--color-muted)]">Sales before returns. Profit uses the cost of the exact batches sold.</p>
          </section>
        </div>
      </div>
    </>
  );
}
