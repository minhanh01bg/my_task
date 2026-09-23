"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { Alert, AlertDescription } from "@/components/ui/alert";

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
      <button
        type="button"
        id="revoke-guest-access-button"
        onClick={handleRevoke}
        disabled={loading}
        className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400"
      >
        {loading ? "Đang thu hồi..." : "Thu hồi liên kết khách"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
