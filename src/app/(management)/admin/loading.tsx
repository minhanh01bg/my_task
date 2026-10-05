import { Skeleton, TableSkeleton } from "@/components/kit";

/** Nam trong <main> cua layout admin — chi render khung noi dung. */
export default function AdminLoading() {
  return (
    <div aria-busy="true" className="space-y-6">
      <p role="status" className="sr-only">
        Đang tải…
      </p>
      <div className="space-y-2">
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="h-9 w-64 rounded-xl" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-24 rounded-2xl" />
        ))}
      </div>
      <TableSkeleton rows={6} />
    </div>
  );
}
