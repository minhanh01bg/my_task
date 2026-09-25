"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { invalidateStorefrontSession } from "@/features/online-store/storefront-session";

export function CustomerLogoutButton() {
  const router = useRouter();
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={async () => {
        await fetch("/api/customer-auth/logout", { method: "POST" });
        invalidateStorefrontSession();
        router.replace("/shop");
        router.refresh();
      }}
    >
      Đăng xuất
    </Button>
  );
}
