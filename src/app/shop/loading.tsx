import {
  CategoryPillSkeleton,
  ProductCardSkeleton,
  Skeleton,
} from "@/components/kit";

export default function ShopLoading() {
  return (
    <main aria-busy="true" className="mx-auto max-w-7xl px-4 py-10">
      <p role="status" className="sr-only">
        Đang tải…
      </p>
      <Skeleton className="h-12 w-2/3 rounded-xl" />
      <div className="mt-6 flex flex-wrap gap-2">
        {Array.from({ length: 5 }, (_, index) => (
          <CategoryPillSkeleton key={index} />
        ))}
      </div>
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    </main>
  );
}
