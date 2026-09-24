"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import {
  applyVoucher,
  normalizeVoucherCode,
  voucherReasonMessage,
  type VoucherRule,
  type VoucherType,
} from "@/lib/vouchers/validate-voucher";
import {
  voucherValidateResponseSchema,
  type VoucherValidateResponse,
} from "@/types/voucher";

/** Mã đang áp dụng — dùng chung giữa giỏ hàng và trang thanh toán. */
const STORAGE_KEY = "online-voucher-v1";
const VALIDATE_URL = "/api/online/vouchers/validate";

export interface AppliedVoucher {
  code: string;
  type: VoucherType;
  discount: number;
  shippingDiscount: number;
}

/** Tham số công khai server trả về, đủ để tính lại khi đổi số lượng. */
interface VoucherPreview {
  rule: VoucherRule;
  shippingDiscount: number;
}

function readStoredCode(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStoredCode(code: string | null): void {
  try {
    if (code) localStorage.setItem(STORAGE_KEY, code);
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Trinh duyet chan storage: van dung duoc trong phien hien tai.
  }
}

async function requestVoucher(
  code: string,
  subtotal: number,
): Promise<VoucherValidateResponse["data"]> {
  const response = await fetch(VALIDATE_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, subtotal: Math.round(subtotal) }),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      typeof body === "object" && body && "message" in body
        ? String(body.message)
        : "Không kiểm tra được mã lúc này";
    throw new Error(message);
  }
  return voucherValidateResponseSchema.parse(body).data;
}

function toPreview(
  data: Extract<VoucherValidateResponse["data"], { ok: true }>,
): VoucherPreview {
  return {
    rule: {
      code: data.code,
      type: data.type,
      value: data.value,
      maxDiscount: data.maxDiscount,
      minOrderTotal: data.minOrderTotal,
      // Han dung/luot dung server da kiem tra; don hang kiem tra lai lan nua.
      maxUses: null,
      usedCount: 0,
      startsAt: null,
      endsAt: null,
      isActive: true,
    },
    shippingDiscount: data.shippingDiscount,
  };
}

/**
 * Nhập/áp mã giảm giá qua API. Không có danh sách mã nào ở client: server trả
 * tham số công khai của mã, giao diện dùng engine thuần để tính lại khi tạm
 * tính thay đổi. Server luôn tính lại voucher khi tạo đơn.
 *
 * `active` = false tạm dừng việc đọc mã đã lưu (vd. giỏ hàng đang đóng).
 * `shippingFee` = phí ship thật của đơn hiện tại (0 khi nhận tại cửa hàng);
 * bỏ trống thì dùng phần giảm ship server trả về lúc kiểm tra mã.
 */
export function useVoucher(
  subtotal: number,
  active = true,
  shippingFee?: number,
) {
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<VoucherPreview | null>(null);
  const [requestError, setRequestError] = useState("");
  const [pending, setPending] = useState(false);

  // Khoi phuc ma da luu (tu gio hang hoac lan truoc) khi mo giao dien.
  useEffect(() => {
    if (!active || subtotal <= 0) return;
    const stored = readStoredCode();
    if (!stored || preview?.rule.code === stored) return;

    let cancelled = false;
    requestVoucher(stored, subtotal)
      .then((data) => {
        if (cancelled) return;
        setInput(data.code);
        if (data.ok) {
          setPreview(toPreview(data));
          setRequestError("");
        } else {
          setPreview(null);
          setRequestError(data.message);
          writeStoredCode(null);
        }
      })
      .catch(() => {
        // Loi mang: giu nguyen, khach co the bam "Áp dụng" lai.
      });
    return () => {
      cancelled = true;
    };
    // Chi chay lai khi bat/tat; tam tinh doi thi tinh lai bang engine ben duoi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const result = useMemo(
    () =>
      preview
        ? applyVoucher(preview.rule, {
            subtotal,
            shippingFee: shippingFee ?? preview.shippingDiscount,
            now: new Date(),
          })
        : null,
    [preview, subtotal, shippingFee],
  );

  const applied: AppliedVoucher | null =
    preview && result?.ok
      ? {
          code: preview.rule.code,
          type: preview.rule.type,
          discount: result.discount,
          shippingDiscount: result.shippingDiscount,
        }
      : null;

  const error =
    preview && result && !result.ok && result.reason
      ? voucherReasonMessage(result.reason, preview.rule)
      : requestError;

  const apply = useCallback(async () => {
    const code = normalizeVoucherCode(input);
    if (!code) {
      setRequestError("Chưa nhập mã giảm giá");
      return;
    }
    setPending(true);
    setRequestError("");
    try {
      const data = await requestVoucher(code, subtotal);
      setInput(data.code);
      if (data.ok) {
        setPreview(toPreview(data));
        writeStoredCode(data.code);
      } else {
        setPreview(null);
        setRequestError(data.message);
      }
    } catch (caught) {
      setRequestError(
        caught instanceof Error ? caught.message : "Không kiểm tra được mã",
      );
    } finally {
      setPending(false);
    }
  }, [input, subtotal]);

  const remove = useCallback(() => {
    setPreview(null);
    setInput("");
    setRequestError("");
    writeStoredCode(null);
  }, []);

  /** Server từ chối mã khi đặt hàng (409 VOUCHER_INVALID): gỡ mã, báo tại ô nhập. */
  const invalidate = useCallback((message: string) => {
    setPreview(null);
    setRequestError(message);
    writeStoredCode(null);
  }, []);

  return {
    input,
    setInput,
    applied,
    /** Mã đã nhận nhưng đơn hiện chưa đủ điều kiện (vd. dưới đơn tối thiểu). */
    pendingCode: preview && !applied ? preview.rule.code : null,
    error,
    pending,
    apply,
    remove,
    invalidate,
  };
}

/** Xoá mã đã lưu (sau khi đặt hàng thành công). */
export function clearStoredVoucher(): void {
  writeStoredCode(null);
}
