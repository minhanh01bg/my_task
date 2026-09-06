export default function ShopLoading() {
  return (
    <main className="mx-auto max-w-7xl animate-pulse px-4 py-10">
      <div className="bg-muted h-12 w-2/3 rounded-xl" />
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="bg-muted aspect-[3/4] rounded-2xl" />
        ))}
      </div>
    </main>
  );
}
