"use client";

import { Button } from "@/components/ui/button";

export default function AccountError({ reset }: { reset: () => void }) {
  return (
    <main className="p-16 text-center">
      <h1 className="text-2xl font-bold">Không thể tải tài khoản</h1>
      <Button onClick={reset} className="mt-5">
        Thử lại
      </Button>
    </main>
  );
}
