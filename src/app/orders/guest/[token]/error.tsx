"use client";

import { ErrorState } from "@/components/kit";

export default function GuestOrderError({ reset }: { reset: () => void }) {
  return (
    <main className="p-16">
      <ErrorState
        title="Không thể tải đơn hàng"
        description="Liên kết tra cứu đơn hàng của khách có thể không chính xác hoặc đã hết hạn."
        onRetry={reset}
      />
    </main>
  );
}
