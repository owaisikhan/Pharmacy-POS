import PageHeader from "@/app/_components/layout/PageHeader";
import { Skeleton } from "@/app/_components/ui/Skeleton";
import { TableSkeleton } from "@/app/_components/ui/TableSkeleton";

export default function Loading() {
  return (
    <>
      <PageHeader title="Medicines" description="Stock shown is what can be sold: expired batches are not counted." />
      <div className="flex flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
          <Skeleton className="h-10 w-96 rounded-lg" delay={0.05} />
        </div>
        <TableSkeleton
          caption="Medicines"
          minWidth="min-w-[56rem]"
          columns={[
            { label: "Medicine", bar: "w-44", subBar: "w-28" },
            { label: "Company", bar: "w-20" },
            { label: "Rack", bar: "w-8" },
            { label: "Price / pack", bar: "w-16", align: "right" },
            { label: "In stock", bar: "w-20", align: "right" },
            { label: "Next expiry", bar: "w-16" },
            { label: "Status", bar: "w-14" },
          ]}
        />
      </div>
    </>
  );
}
