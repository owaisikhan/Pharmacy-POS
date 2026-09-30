import PageHeader from "@/app/_components/layout/PageHeader";
import OpenShiftForm from "@/app/_components/shifts/OpenShiftForm";
import CloseShiftForm from "@/app/_components/shifts/CloseShiftForm";
import Pager from "@/app/_components/ui/Pager";
import Badge from "@/app/_components/ui/Badge";
import { getOpenShift, listShifts } from "@/app/_lib/data-service";
import { requireUser } from "@/app/_lib/helpers";
import { pageNumber } from "@/app/_lib/url-helpers";
import { formatDateTime, formatRs } from "@/app/_lib/format-helpers";

export const metadata = { title: "Cash shifts" };

export default async function ShiftsPage({ searchParams }) {
  await requireUser();
  const sp = await searchParams;
  const page = pageNumber(sp.page);
  const [shift, history] = await Promise.all([getOpenShift(), listShifts(page)]);
  const s = shift?.summary;

  return (
    <>
      <PageHeader
        title="Cash shifts"
        description="Count the drawer when a shift opens and when it closes. The app works out what should be there."
        actions={shift ? <CloseShiftForm expected={Number(s.expected_cash)} /> : null}
      />
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-6">
        {shift ? (
          <section className="card max-w-2xl p-5">
            <h2 className="text-base font-semibold">
              Open since {formatDateTime(shift.opened_at)}, by {shift.opener?.full_name}
            </h2>
            <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
              <Row label="Opening cash" value={formatRs(s.opening_float)} />
              <Row label="Bills" value={s.bills} />
              <Row label="Cash sales" value={`+ ${formatRs(s.cash_sales)}`} />
              <Row label="Card sales (not in drawer)" value={formatRs(s.card_sales)} />
              <Row label="Account payments in cash" value={`+ ${formatRs(s.customer_cash_in)}`} />
              <Row label="Sold on account (not in drawer)" value={formatRs(s.credit_sales)} />
              <Row label="Cash refunds" value={`- ${formatRs(s.cash_refunds)}`} />
            </dl>
            <div className="mt-4 flex items-baseline justify-between border-t border-[var(--color-border)] pt-3">
              <span className="font-semibold">Cash that should be in the drawer</span>
              <span className="num text-2xl font-bold">{formatRs(s.expected_cash)}</span>
            </div>
          </section>
        ) : (
          <section className="card max-w-md p-5">
            <h2 className="mb-3 text-base font-semibold">Open a shift</h2>
            <OpenShiftForm />
          </section>
        )}

        <section>
          <h2 className="mb-2 text-base font-semibold">Closed shifts</h2>
          {history.rows.length === 0 ? (
            <p className="text-sm text-[var(--color-muted)]">No shift has been closed yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="table min-w-[52rem]">
                <caption className="sr-only">Closed shifts</caption>
                <thead>
                  <tr>
                    <th scope="col">Opened</th>
                    <th scope="col">Closed</th>
                    <th scope="col">By</th>
                    <th scope="col" className="text-right">Opening cash</th>
                    <th scope="col" className="text-right">Expected</th>
                    <th scope="col" className="text-right">Counted</th>
                    <th scope="col" className="text-right">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {history.rows.map((h) => {
                    const diff = Number(h.counted_cash) - Number(h.expected_cash);
                    return (
                      <tr key={h.id}>
                        <td className="whitespace-nowrap">{formatDateTime(h.opened_at)}</td>
                        <td className="whitespace-nowrap">{formatDateTime(h.closed_at)}</td>
                        <td>
                          {h.opener?.full_name}
                          {h.closer && h.closer.full_name !== h.opener?.full_name ? `, closed by ${h.closer.full_name}` : ""}
                          {h.note ? <p className="text-xs text-[var(--color-muted)]">{h.note}</p> : null}
                        </td>
                        <td className="num">{formatRs(h.opening_float)}</td>
                        <td className="num">{formatRs(h.expected_cash)}</td>
                        <td className="num">{formatRs(h.counted_cash)}</td>
                        <td className="num">
                          {Math.abs(diff) < 0.005 ? (
                            <Badge tone="good">Matched</Badge>
                          ) : (
                            <Badge tone={diff > 0 ? "info" : "bad"}>{diff > 0 ? "Over" : "Short"} {formatRs(diff)}</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="mt-3">
            <Pager pathname="/shifts" params={{ page: sp.page }} page={page} count={history.count} noun="shifts" />
          </div>
        </section>
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
