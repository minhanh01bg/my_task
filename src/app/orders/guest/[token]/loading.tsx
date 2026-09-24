import { Skeleton, TableSkeleton } from "@/components/kit";

export default function GuestOrderLoading() {
  return (
    <main aria-busy="true" className="mx-auto max-w-3xl px-4 py-12">
      <p role="status" className="sr-only">
        Đang tải…
      </p>
      <Skeleton className="h-12 w-72 rounded-xl" />
      <TableSkeleton rows={3} className="mt-8" />
    </main>
  );
}
