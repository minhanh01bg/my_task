import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Không tìm thấy trang",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="bg-background text-foreground mx-auto flex min-h-dvh w-full max-w-3xl items-center justify-center px-6 py-14">
      <div className="space-y-4 text-center">
        <p className="text-muted-foreground text-sm font-medium">404</p>
        <h1 className="font-heading text-2xl font-bold">
          Không tìm thấy trang
        </h1>
        <p className="text-muted-foreground text-sm">
          Trang bạn tìm không tồn tại hoặc đã được chuyển đi.
        </p>
        <Button nativeButton={false} render={<Link href="/shop" />}>
          Về cửa hàng
        </Button>
      </div>
    </main>
  );
}
