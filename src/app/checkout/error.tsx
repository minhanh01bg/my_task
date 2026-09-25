"use client";

import { Button } from "@/components/ui/button";

export default function CheckoutError({ reset }: { reset: () => void }) {
  return (
    <main className="p-20 text-center">
      <h1 className="text-3xl font-bold">Không thể mở thanh toán</h1>
      <Button onClick={reset} size="lg" className="mt-5 font-bold">
        Thử lại
      </Button>
    </main>
  );
}
