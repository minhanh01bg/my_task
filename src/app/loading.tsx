export default function Loading() {
  return (
    <main
      aria-busy="true"
      className="mx-auto flex min-h-dvh w-full max-w-4xl items-center justify-center px-6 py-14"
    >
      <p role="status" className="text-muted-foreground text-sm">
        Đang tải…
      </p>
    </main>
  );
}
