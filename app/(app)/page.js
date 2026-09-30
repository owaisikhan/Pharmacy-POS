import Link from "next/link";
import { ArrowRight, Banknote, CalendarClock, ReceiptText, ScanBarcode, TrendingUp, TriangleAlert, Wallet } from "lucide-react";
import PageHeader from "@/app/_components/layout/PageHeader";
import StatCard from "@/app/_components/ui/StatCard";
import EmptyState from "@/app/_components/ui/EmptyState";
import { ExpiryBadge } from "@/app/_components/medicines/StockBadges";
import { getDashboard, getOpenShift } from "@/app/_lib/data-service";
import { requireUser } from "@/app/_lib/helpers";
import { formatCount, formatDateTime, formatDay, formatExpiry, formatRs, formatTime, formatUnits } from "@/app/_lib/format-helpers";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage({ searchParams }) {
  const { isAdmin, profile } = await requireUser();
  const { denied } = await searchParams;
  const [d, shift] = await Promise.all([getDashboard(), getOpenShift()]);
  const s = d.summary;

  return (
    <>
      <PageHeader
        title={`Today, ${formatDay(d.today)}`}
        description={`Signed in as ${profile.full_name || profile.email}.`}
        actions={
          <Link href="/pos" className="btn btn-primary">
            <ScanBarcode className="h-4 w-4" aria-hidden /> New sale <span className="kbd border-white/40 bg-transparent text-white">F2</span>
          </Link>
        }
      />
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-6">
        {denied ? (
          <p role="alert" className="rounded-lg bg-[var(--color-warning-soft)] px-3 py-2 text-sm font-medium text-[var(--color-warning)]">
            That page is for the owner only.
          </p>
        ) : null}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard icon={TrendingUp} label="Net sales today" value={formatRs(s.net_sales)} note={`${formatCount(s.bills)} bills${Number(s.returns) > 0 ? `, ${formatRs(s.returns)} returned` : ""}`} />
          <StatCard icon={Banknote} label="Cash / card / account" value={formatRs(s.cash)} note={`Cash. Card ${formatRs(s.card)}, account ${formatRs(s.credit)}`} />
          {isAdmin ? (
            <StatCard icon={ReceiptText} label="Profit today" value={formatRs(s.profit)} tone={Number(s.profit) < 0 ? "bad" : "good"} note={`${Number(s.profit) < 0 ? "Loss. " : ""}After cost of medicines sold, before expenses`} />
          ) : (
            <StatCard icon={ReceiptText} label="Bills today" value={formatCount(s.bills)} note="Every bill saved since midnight" />
          )}
          <StatCard
            icon={Wallet}
            label="Cash in drawer now"
            value={shift ? formatRs(shift.summary.expected_cash) : "No shift"}
            note={shift ? `Expected, shift open since ${formatTime(shift.opened_at)}` : "Open a shift to start selling"}
            tone={shift ? undefined : "bad"}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <section className="card flex flex-col p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <TriangleAlert className="h-4 w-4 text-[var(--color-warning)]" aria-hidden /> Low stock ({formatCount(d.lowCount)})
              </h2>
              <Link href="/medicines?filter=low" className="text-sm font-medium text-[var(--color-primary)] hover:underline">See all</Link>
            </div>
            {d.low.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">Every medicine is above its reorder level.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--color-border-soft)]">
                {d.low.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <Link href={`/medicines/${m.id}`} className="min-w-0 truncate font-medium hover:underline">{m.name} {m.strength}</Link>
                    <span className={`num ${m.sellable_units === 0 ? "font-semibold text-[var(--color-danger)]" : ""}`}>
                      {m.sellable_units === 0 ? "Out of stock" : formatUnits(m.sellable_units, m.units_per_pack)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card flex flex-col p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <CalendarClock className="h-4 w-4 text-[var(--color-danger)]" aria-hidden /> Expiring in 30 days ({formatCount(d.expiringCount)})
              </h2>
              <Link href="/expiry?window=30" className="text-sm font-medium text-[var(--color-primary)] hover:underline">See all</Link>
            </div>
            {d.expiredCount > 0 ? (
              <Link href="/expiry?window=expired" className="mb-2 flex items-center justify-between rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm font-semibold text-[var(--color-danger)]">
                {formatCount(d.expiredCount)} expired batch{d.expiredCount === 1 ? "" : "es"} still on the shelf <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            ) : null}
            {d.expiring.length === 0 ? (
              <p className="text-sm text-[var(--color-muted)]">Nothing in stock expires in the next 30 days.</p>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--color-border-soft)]">
                {d.expiring.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <Link href={`/medicines/${b.medicine.id}`} className="block truncate font-medium hover:underline">{b.medicine.name} {b.medicine.strength}</Link>
                      <span className="text-xs text-[var(--color-muted)]">Batch {b.batch_no}, {formatUnits(b.qty_on_hand, b.medicine.units_per_pack)}, exp {formatExpiry(b.expiry_date)}</span>
                    </span>
                    <ExpiryBadge expiry={b.expiry_date} today={d.today} />
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card flex flex-col p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <ReceiptText className="h-4 w-4 text-[var(--color-muted)]" aria-hidden /> Latest bills
              </h2>
              <Link href="/sales" className="text-sm font-medium text-[var(--color-primary)] hover:underline">See all</Link>
            </div>
            {d.recent.length === 0 ? (
              <EmptyState title="No bills yet">Bills appear here as soon as they are saved.</EmptyState>
            ) : (
              <ul className="flex flex-col divide-y divide-[var(--color-border-soft)]">
                {d.recent.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="min-w-0">
                      <Link href={`/sales/${r.id}`} className="font-mono font-medium hover:underline">{r.invoice_no}</Link>
                      <span className="ml-2 text-xs text-[var(--color-muted)]">{formatDateTime(r.created_at)}{r.customer ? `, ${r.customer.name}` : ""}</span>
                    </span>
                    <span className="num font-semibold">{formatRs(r.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
