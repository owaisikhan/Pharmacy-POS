import { PageHeaderSkeleton } from "@/app/_components/ui/PageHeaderSkeleton";
import { TableSkeleton } from "@/app/_components/ui/TableSkeleton";

// Fallback for any signed-in page without its own loading.js.
export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="px-4 py-6 sm:px-6">
        <TableSkeleton caption="Loading" minWidth="min-w-[40rem]" columns={[{ label: "One", bar: "w-40" }, { label: "Two", bar: "w-24" }, { label: "Three", bar: "w-20", align: "right" }]} />
      </div>
    </>
  );
}
