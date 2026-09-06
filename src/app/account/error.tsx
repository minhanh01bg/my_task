"use client";
export default function AccountError({ reset }: { reset: () => void }) {
  return (
    <main className="p-16 text-center">
      <h1 className="text-2xl font-bold">Không thể tải tài khoản</h1>
      <button
        onClick={reset}
        className="bg-primary text-primary-foreground mt-5 min-h-11 rounded-xl px-5"
      >
        Thử lại
      </button>
    </main>
  );
}
