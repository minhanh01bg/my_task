export default function CheckoutLoading() {
  return (
    <main className="mx-auto max-w-6xl animate-pulse px-4 py-10">
      <div className="bg-muted h-12 w-72 rounded-xl" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_24rem]">
        <div className="bg-muted h-96 rounded-2xl" />
        <div className="bg-muted h-80 rounded-2xl" />
      </div>
    </main>
  );
}
