import { Skeleton } from "@/components/kit";

export default function AccountLoading() {
  return (
    <main aria-busy="true" className="mx-auto max-w-5xl px-4 py-16">
      <p role="status" className="sr-only">
        Đang tải…
      </p>
      <Skeleton className="h-10 w-64 rounded-xl" />
      <Skeleton className="mt-8 h-48 rounded-2xl" />
    </main>
  );
}
