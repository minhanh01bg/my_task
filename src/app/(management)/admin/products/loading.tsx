import { Skeleton, TableSkeleton } from "@/components/kit";

/** Khung trang Sản phẩm: tiêu đề, thanh lọc rồi bảng — khớp bố cục thật. */
export default function AdminProductsLoading() {
  return (
    <div aria-busy="true" className="space-y-6">
      <p role="status" className="sr-only">
        Đang tải danh sách sản phẩm…
      </p>
      <div className="space-y-2">
        <Skeleton className="h-9 w-48 rounded-xl" />
        <Skeleton className="h-4 w-72 max-w-full" />
      </div>
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-11 w-full max-w-sm rounded-xl" />
        <Skeleton className="h-11 w-32 rounded-xl" />
        <Skeleton className="h-11 w-32 rounded-xl" />
      </div>
      <TableSkeleton rows={8} />
    </div>
  );
}
