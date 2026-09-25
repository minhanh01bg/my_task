"use client";

import { Button } from "@/components/ui/button";

export default function ShopError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-24 text-center">
      <h1 className="text-3xl font-bold">Chưa thể tải cửa hàng</h1>
      <p className="text-muted-foreground mt-3">
        Vui lòng kiểm tra kết nối và thử lại.
      </p>
      <Button onClick={reset} size="lg" className="mt-6 font-bold">
        Thử lại
      </Button>
    </main>
  );
}
