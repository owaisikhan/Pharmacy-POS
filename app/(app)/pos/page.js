import { Wallet } from "lucide-react";
import PosScreen from "@/app/_components/pos/PosScreen";
import OpenShiftForm from "@/app/_components/shifts/OpenShiftForm";
import { getOpenShift } from "@/app/_lib/data-service";
import { requireUser } from "@/app/_lib/helpers";

export const metadata = { title: "New sale" };

export default async function PosPage() {
  await requireUser();
  const shift = await getOpenShift();
  if (!shift) {
    return (
      <div className="grid place-items-center px-4 py-16">
        <div className="card w-full max-w-md p-6">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-full bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
              <Wallet className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-lg font-semibold">Open a shift to start selling</h1>
              <p className="text-sm text-[var(--color-muted)]">The drawer is counted at the start and end of every shift.</p>
            </div>
          </div>
          <OpenShiftForm />
        </div>
      </div>
    );
  }
  return <PosScreen />;
}
