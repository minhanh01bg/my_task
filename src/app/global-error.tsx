"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="vi">
      <body className="bg-background text-foreground min-h-dvh font-sans antialiased">
        <main className="mx-auto flex min-h-dvh max-w-xl items-center justify-center p-6">
          <div className="space-y-4 text-center">
            <h1 className="font-heading text-2xl font-bold">
              Đã có lỗi xảy ra
            </h1>
            <p className="text-muted-foreground text-sm">
              Lỗi đã được ghi nhận. Vui lòng thử lại hoặc quay về cửa hàng.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button onClick={reset}>Thử lại</Button>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/shop" />}
              >
                Về cửa hàng
              </Button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
