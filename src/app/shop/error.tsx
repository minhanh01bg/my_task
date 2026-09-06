"use client";
export default function ShopError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-3xl font-bold">Chưa thể tải cửa hàng</h1>
      <p className="text-muted-foreground mt-3">
        Vui lòng kiểm tra kết nối và thử lại.
      </p>
      <button
        onClick={reset}
        className="bg-primary text-primary-foreground mt-6 min-h-11 rounded-xl px-5 font-bold"
      >
        Thử lại
      </button>
    </main>
  );
}
