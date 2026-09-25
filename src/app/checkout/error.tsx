"use client";

import { ErrorState } from "@/components/kit";

export default function CheckoutError({ reset }: { reset: () => void }) {
  return (
    <main className="p-16 sm:p-20">
      <ErrorState
        title="Không thể mở thanh toán"
        description="Đã xảy ra sự cố trong quá trình khởi tạo đơn hàng. Vui lòng thử lại."
        onRetry={reset}
      />
    </main>
  );
}
