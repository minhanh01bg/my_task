"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function ClaimOrderButton({ guestToken }: { guestToken: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleClaim() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/customer/orders/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: guestToken }),
      });

      if (res.status === 401) {
        router.push("/account");
        return;
      }

      if (!res.ok) {
        throw new Error(
          "Không thể liên kết đơn hàng hoặc số điện thoại không khớp.",
        );
      }

      const data = await res.json();
      router.push(`/account/orders/${data.orderId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6 border-t pt-4">
      <Button
        type="button"
        id="claim-guest-order-button"
        onClick={handleClaim}
        disabled={loading}
        className="w-full"
        size="lg"
      >
        {loading ? "Đang liên kết..." : "Lưu đơn hàng vào tài khoản của bạn"}
      </Button>
      {error && (
        <p className="text-destructive mt-2 text-center text-sm">{error}</p>
      )}
    </div>
  );
}
