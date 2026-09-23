import { Skeleton } from "@/components/kit";

export default function LoginLoading() {
  return (
    <main aria-busy="true" className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <p role="status" className="sr-only">
        Đang tải…
      </p>
      <section className="bg-primary/90 hidden lg:block" />
      <section className="flex items-center justify-center p-5 sm:p-8">
        <div className="surface-panel w-full max-w-md space-y-4 p-6 sm:p-8">
          <Skeleton className="h-3 w-24 rounded-full" />
          <Skeleton className="h-9 w-3/4 rounded-xl" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="mt-4 h-13 w-full rounded-xl" />
          <Skeleton className="h-13 w-full rounded-xl" />
        </div>
      </section>
    </main>
  );
}
