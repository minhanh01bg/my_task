"use client";

import { ErrorState } from "@/components/kit";

export default function ShopError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <ErrorState
        title="Chưa thể tải cửa hàng"
        description="Đã xảy ra sự cố khi tải danh mục sản phẩm. Vui lòng kiểm tra kết nối mạng và thử lại."
        onRetry={reset}
      />
    </main>
  );
}
