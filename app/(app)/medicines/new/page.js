import PageHeader from "@/app/_components/layout/PageHeader";
import MedicineForm from "@/app/_components/medicines/MedicineForm";
import { listCategories } from "@/app/_lib/data-service";
import { requireAdmin } from "@/app/_lib/helpers";

export const metadata = { title: "Add medicine" };

export default async function NewMedicinePage() {
  await requireAdmin();
  const { categories, companies } = await listCategories();
  return (
    <>
      <PageHeader title="Add medicine" description="Stock is added by recording a purchase, with its batch and expiry." />
      <div className="px-4 py-6 sm:px-6">
        <div className="card max-w-5xl p-5">
          <MedicineForm categories={categories} companies={companies} />
        </div>
      </div>
    </>
  );
}
