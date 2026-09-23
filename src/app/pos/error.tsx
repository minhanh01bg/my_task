"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * Loi khi mo man hinh ban hang. `logger` chi chay phia server; o day ghi
 * nhan qua Sentry giong global-error.
 */
export default function PosError({
  error,
  reset,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  /** Next 16: tai lai ca du lieu Server Component, khong chi render lai. */
  unstable_retry?: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center justify-center p-6">
      <div
        role="alert"
        className="surface-panel flex w-full flex-col items-center gap-3 px-6 py-10 text-center"
      >
        <AlertTriangle
          aria-hidden="true"
          className="text-destructive size-10"
        />
        <h1 className="font-heading text-2xl font-bold">
          Không thể mở màn hình bán hàng
        </h1>
        <p className="text-muted-foreground text-sm">
          Đơn đang bán dở vẫn được giữ trên máy này. Kiểm tra kết nối rồi thử
          lại.
        </p>
        {error.digest ? (
          <p className="text-muted-foreground font-mono text-xs">
            Mã lỗi: {error.digest}
          </p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Button
            className="min-h-touch"
            onClick={() => (unstable_retry ?? reset)()}
          >
            Thử lại
          </Button>
          <Button
            variant="outline"
            className="min-h-touch"
            nativeButton={false}
            render={<Link href="/admin/products" />}
          >
            Vào trang quản lý
          </Button>
        </div>
      </div>
    </main>
  );
}
