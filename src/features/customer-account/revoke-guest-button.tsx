"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function RevokeGuestButton({ orderId }: { orderId: string }) {
  const [loading, setLoading] = useState(false);
  const [revoked, setRevoked] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRevoke() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/customer/orders/guest-access/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });

      if (!res.ok) {
        throw new Error("Không thể thu hồi quyền truy cập");
      }

      setRevoked(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã xảy ra lỗi");
    } finally {
      setLoading(false);
    }
  }

  if (revoked) {
    return (
      <Alert variant="success" role="status" className="mt-4">
        <Check aria-hidden="true" />
        <AlertDescription>
          Đã thu hồi toàn bộ quyền truy cập của khách cho đơn hàng này.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="mt-6 border-t pt-4">
      <Button
        type="button"
        id="revoke-guest-access-button"
        variant="destructive"
        onClick={handleRevoke}
        disabled={loading}
      >
        {loading ? "Đang thu hồi..." : "Thu hồi liên kết khách"}
      </Button>
      {error && <p className="text-destructive mt-2 text-sm">{error}</p>}
    </div>
  );
}
