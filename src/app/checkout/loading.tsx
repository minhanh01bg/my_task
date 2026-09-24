import { Skeleton } from "@/components/kit";

export default function CheckoutLoading() {
  return (
    <main aria-busy="true" className="mx-auto max-w-6xl px-4 py-10">
      <p role="status" className="sr-only">
        Đang tải…
      </p>
      <Skeleton className="h-12 w-72 rounded-xl" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    </main>
  );
}
