import PageHeader from "@/app/_components/layout/PageHeader";
import { Skeleton } from "@/app/_components/ui/Skeleton";
import { TableSkeleton, TableSummarySkeleton } from "@/app/_components/ui/TableSkeleton";

export default function Loading() {
  return (
    <>
      <PageHeader title="Bills and returns" description="Find a bill to reprint it or take a return." />
      <div className="flex flex-col gap-4 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-10 w-full max-w-sm rounded-lg" />
          <Skeleton className="h-10 w-64 rounded-lg" delay={0.05} />
        </div>
        <TableSummarySkeleton />
        <TableSkeleton
          caption="Bills"
          minWidth="min-w-[48rem]"
          columns={[
            { label: "Bill", bar: "w-24" },
            { label: "Time", bar: "w-16" },
            { label: "Customer", bar: "w-28" },
            { label: "Cashier", bar: "w-20" },
            { label: "Items", bar: "w-6", align: "right" },
            { label: "Paid by", bar: "w-12" },
            { label: "Total", bar: "w-20", align: "right" },
          ]}
        />
      </div>
    </>
  );
}
