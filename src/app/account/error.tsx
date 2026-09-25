"use client";

import { ErrorState } from "@/components/kit";

export default function AccountError({ reset }: { reset: () => void }) {
  return (
    <main className="p-16">
      <ErrorState
        title="Không thể tải tài khoản"
        description="Đã xảy ra sự cố khi tải thông tin tài khoản. Vui lòng kiểm tra kết nối và thử lại."
        onRetry={reset}
      />
    </main>
  );
}
