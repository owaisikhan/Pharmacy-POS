import { Skeleton } from "@/app/_components/ui/Skeleton";

export default function Loading() {
  return (
    <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-[minmax(0,1fr)_21rem] sm:p-6">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-80 w-full rounded-xl" delay={0.08} />
      </div>
      <div className="flex flex-col gap-3">
        <Skeleton className="h-24 w-full rounded-xl" delay={0.04} />
        <Skeleton className="h-36 w-full rounded-xl" delay={0.08} />
        <Skeleton className="h-72 w-full rounded-xl" delay={0.12} />
      </div>
    </div>
  );
}
