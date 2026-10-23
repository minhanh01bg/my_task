"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, BellRing } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { productHref, type HrefProduct } from "@/lib/seo/product-href";
import { cn } from "@/lib/utils";
import {
  BACK_IN_STOCK_ENDPOINT,
  backInStockStateSchema,
  type BackInStockUpdate,
} from "@/types/back-in-stock";

import { useStorefrontSession } from "./session-aware-actions";
import {
  invalidateStorefrontSession,
  loadStorefrontSession,
} from "./storefront-session";

const STATE_FAILED_MESSAGE = "Không tải được trạng thái. Vui lòng thử lại.";
const UPDATE_FAILED_MESSAGE = "Không cập nhật được đăng ký. Vui lòng thử lại.";
const NETWORK_FAILED_MESSAGE = "Mất kết nối. Vui lòng thử lại.";

/** Cùng khung với các nút trong hàng CTA của trang sản phẩm. */
const CTA_CLASS = "min-h-12 w-full gap-2 rounded-xl text-base font-bold";

async function readFailure(
  response: Response,
  fallback: string,
): Promise<{ code?: string; message: string }> {
  try {
    const body: unknown = await response.json();
    if (
      typeof body === "object" &&
      body !== null &&
      "message" in body &&
      typeof body.message === "string"
    ) {
      const code =
        "code" in body && typeof body.code === "string" ? body.code : undefined;
      return { code, message: body.message };
    }
  } catch {
    // Body không phải JSON — dùng thông báo mặc định.
  }
  return { message: fallback };
}

/** `subscribed` từ body 200, `null` khi body sai hợp đồng. */
async function readSubscribed(response: Response): Promise<boolean | null> {
  try {
    const parsed = backInStockStateSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.subscribed : null;
  } catch {
    return null;
  }
}

function CustomerToggle({
  productId,
  onSignedOut,
}: {
  productId: string;
  onSignedOut: () => void;
}) {
  const router = useRouter();
  // null: đang tải trạng thái đăng ký.
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ productId });
    fetch(`${BACK_IN_STOCK_ENDPOINT}?${params}`, {
      headers: { Accept: "application/json" },
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 401) {
          if (!controller.signal.aborted) onSignedOut();
          return;
        }
        const state = response.ok ? await readSubscribed(response) : null;
        const failure =
          state === null
            ? await readFailure(response, STATE_FAILED_MESSAGE)
            : null;
        if (controller.signal.aborted) return;
        // Không rõ trạng thái thì coi như chưa bật: POST đặt trạng thái mong
        // muốn nên bấm lại vẫn an toàn.
        setSubscribed(state ?? false);
        if (failure) setError(failure.message);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setSubscribed(false);
        setError(NETWORK_FAILED_MESSAGE);
      });
    return () => controller.abort();
  }, [productId, onSignedOut]);

  const handleToggle = async () => {
    if (subscribed === null || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(BACK_IN_STOCK_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          productId,
          subscribed: !subscribed,
        } satisfies BackInStockUpdate),
      });
      if (response.status === 401) {
        onSignedOut();
        return;
      }
      if (!response.ok) {
        const failure = await readFailure(response, UPDATE_FAILED_MESSAGE);
        setError(failure.message);
        // Hàng vừa về: tải lại để trang hiện nút mua thay cho nút này.
        if (response.status === 409 && failure.code === "product_in_stock") {
          router.refresh();
        }
        return;
      }
      const next = await readSubscribed(response);
      if (next === null) setError(UPDATE_FAILED_MESSAGE);
      else setSubscribed(next);
    } catch {
      setError(NETWORK_FAILED_MESSAGE);
    } finally {
      setSaving(false);
    }
  };

  const busy = subscribed === null || saving;
  return (
    <>
      <Button
        type="button"
        size="lg"
        variant="outline"
        aria-pressed={subscribed === true}
        aria-busy={busy}
        disabled={busy}
        onClick={() => void handleToggle()}
        className={cn(
          CTA_CLASS,
          "aria-pressed:border-primary/40 aria-pressed:bg-primary/10 aria-pressed:text-primary",
        )}
      >
        {subscribed ? (
          <BellRing aria-hidden="true" className="size-5" />
        ) : (
          <Bell aria-hidden="true" className="size-5" />
        )}
        <span>Báo khi có hàng</span>
      </Button>
      {subscribed ? (
        <p role="status" className="text-success text-xs">
          Đã bật: bạn sẽ nhận thông báo trong hộp thư khi sản phẩm có hàng.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
    </>
  );
}

/**
 * Bật/tắt "Báo khi có hàng" cho sản phẩm hết hàng. Trang sản phẩm là ISR nên
 * phiên và trạng thái đăng ký chỉ hỏi trong trình duyệt.
 */
export function BackInStockButton({ product }: { product: HrefProduct }) {
  const { isCustomer } = useStorefrontSession();
  // API báo hết phiên: giữ link đăng nhập dù cache phiên còn cũ, tránh hỏi lặp.
  const [signedOut, setSignedOut] = useState(false);
  const handleSignedOut = useCallback(() => {
    setSignedOut(true);
    invalidateStorefrontSession();
    void loadStorefrontSession();
  }, []);

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      {isCustomer && !signedOut ? (
        <CustomerToggle
          key={product.id}
          productId={product.id}
          onSignedOut={handleSignedOut}
        />
      ) : (
        <Link
          href={`/account/login?next=${encodeURIComponent(productHref(product))}`}
          className={cn(
            buttonVariants({ variant: "outline", size: "lg" }),
            CTA_CLASS,
            "h-auto py-2 text-center whitespace-normal",
          )}
        >
          <Bell aria-hidden="true" className="size-5" />
          <span>Đăng nhập để nhận thông báo khi có hàng</span>
        </Link>
      )}
    </div>
  );
}
