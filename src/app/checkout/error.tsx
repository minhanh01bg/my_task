"use client";
export default function CheckoutError({ reset }: { reset: () => void }) {
  return (
    <main className="p-20 text-center">
      <h1 className="text-3xl font-bold">Không thể mở thanh toán</h1>
      <button
        onClick={reset}
        className="bg-primary text-primary-foreground mt-5 min-h-11 rounded-xl px-5 font-bold"
      >
        Thử lại
      </button>
    </main>
  );
}
