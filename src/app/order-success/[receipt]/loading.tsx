import { Skeleton } from "@/components/kit";

export default function OrderSuccessLoading() {
  return (
    <main
      aria-busy="true"
      className="mx-auto flex max-w-xl flex-col items-center px-4 py-16 sm:py-24"
    >
      <p role="status" className="sr-only">
        Đang tải biên nhận…
      </p>
      <Skeleton className="size-16 rounded-full" />
      <Skeleton className="mt-5 h-9 w-72 max-w-full rounded-xl" />
      <Skeleton className="mt-3 h-4 w-80 max-w-full" />
      <div className="surface-panel mt-8 w-full space-y-3 p-6">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex justify-between gap-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </main>
  );
}
