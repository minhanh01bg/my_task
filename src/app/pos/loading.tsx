import {
  CategoryPillSkeleton,
  ProductCardSkeleton,
  Skeleton,
} from "@/components/kit";

/** Cung khung luoi voi PosScreen de khong nhay bo cuc khi du lieu ve. */
export default function PosLoading() {
  return (
    <main
      aria-busy="true"
      className="mx-auto grid min-h-dvh w-full max-w-[1800px] grid-cols-1 gap-4 p-3 sm:p-5 lg:h-dvh lg:grid-cols-[minmax(0,1fr)_430px] lg:gap-5 lg:p-6"
    >
      <p role="status" className="sr-only">
        Đang tải màn hình bán hàng…
      </p>
      <section className="flex min-h-0 flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Skeleton className="h-6 w-32 rounded-full" />
            <Skeleton className="h-8 w-64 rounded-xl" />
          </div>
          <Skeleton className="h-11 w-44 rounded-xl" />
        </div>
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 5 }, (_, index) => (
            <CategoryPillSkeleton key={index} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <ProductCardSkeleton key={index} />
          ))}
        </div>
      </section>
      <aside className="surface-panel flex flex-col gap-3 p-4">
        <Skeleton className="h-6 w-28" />
        {Array.from({ length: 3 }, (_, index) => (
          <Skeleton key={index} className="h-14 w-full rounded-xl" />
        ))}
        <Skeleton className="mt-auto h-14 w-full rounded-xl" />
      </aside>
    </main>
  );
}
