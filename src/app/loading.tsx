import { Skeleton } from "@/components/kit";

export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="mx-auto flex min-h-dvh w-full max-w-4xl flex-col justify-center gap-4 px-6 py-14"
    >
      <p role="status" className="sr-only">
        Đang tải…
      </p>
      <Skeleton className="h-9 w-2/3 rounded-xl" />
      <Skeleton className="h-4 w-1/2" />
      <Skeleton className="mt-4 h-48 w-full rounded-2xl" />
    </main>
  );
}
