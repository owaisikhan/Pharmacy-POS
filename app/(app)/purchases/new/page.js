import PageHeader from "@/app/_components/layout/PageHeader";
import PurchaseForm from "@/app/_components/purchases/PurchaseForm";
import { listMedicineOptions, listSuppliers } from "@/app/_lib/data-service";
import { requireAdmin } from "@/app/_lib/helpers";

export const metadata = { title: "Record purchase" };

export default async function NewPurchasePage() {
  await requireAdmin();
  const [{ rows: suppliers }, medicines] = await Promise.all([listSuppliers({ all: true }), listMedicineOptions()]);
  return (
    <>
      <PageHeader title="Record purchase" description="Copy the supplier's invoice. Stock goes up the moment you save." />
      <div className="px-4 py-6 sm:px-6">
        <PurchaseForm suppliers={suppliers.filter((s) => s.active)} medicines={medicines} />
      </div>
    </>
  );
}
