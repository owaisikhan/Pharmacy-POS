import PageHeader from "@/app/_components/layout/PageHeader";
import SettingsForm from "@/app/_components/settings/SettingsForm";
import StaffRow from "@/app/_components/settings/StaffRow";
import { getSettings, listStaff } from "@/app/_lib/data-service";
import { requireAdmin } from "@/app/_lib/helpers";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { user } = await requireAdmin();
  const [settings, staff] = await Promise.all([getSettings(), listStaff()]);
  return (
    <>
      <PageHeader title="Settings" description="Your pharmacy's details for receipts, and who can use the app." />
      <div className="flex flex-col gap-6 px-4 py-6 sm:px-6">
        <section className="card max-w-3xl p-5">
          <h2 className="mb-4 text-base font-semibold">Pharmacy details</h2>
          <SettingsForm settings={settings} />
        </section>
        <section className="max-w-4xl">
          <h2 className="mb-1 text-base font-semibold">Staff</h2>
          <p className="mb-3 text-sm text-[var(--color-muted)]">
            New people sign up at the sign-up page, then wait here until you switch them on. Staff can sell, take returns and payments, and
            open and close shifts. Only an owner sees costs and profit, records purchases, changes prices and adjusts stock.
          </p>
          <div className="table-wrap">
            <table className="table min-w-[44rem]">
              <caption className="sr-only">Staff</caption>
              <thead>
                <tr>
                  <th scope="col">Person</th>
                  <th scope="col">Joined</th>
                  <th scope="col">Status</th>
                  <th scope="col">Role</th>
                  <th scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {staff.map((p) => <StaffRow key={p.id} person={p} isSelf={p.id === user.id} />)}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
