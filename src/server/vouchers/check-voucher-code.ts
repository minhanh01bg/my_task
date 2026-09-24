import {
  applyVoucher,
  describeVoucher,
  normalizeVoucherCode,
  voucherReasonMessage,
} from "@/lib/vouchers/validate-voucher";
import { formatVnd } from "@/lib/money";
import { resolveShippingFee } from "@/server/orders/shipping-fee";
import type { VoucherValidateResponse } from "@/types/voucher";

import { getVoucherByCode } from "./get-voucher";

/**
 * Xem trước voucher cho khách (giỏ hàng / checkout). Chỉ để hiển thị — đơn
 * hàng luôn tính lại voucher từ DB trong `createOnlineOrder`.
 */
export async function checkVoucherCode(
  rawCode: string,
  subtotal: number,
  now: Date = new Date(),
): Promise<VoucherValidateResponse["data"]> {
  const code = normalizeVoucherCode(rawCode);
  const [voucher, shippingFee] = await Promise.all([
    getVoucherByCode(code),
    resolveShippingFee(),
  ]);
  const result = applyVoucher(voucher, { subtotal, shippingFee, now });

  if (!voucher || !result.ok) {
    return {
      ok: false,
      code,
      message: voucherReasonMessage(result.reason ?? "not_found", voucher),
    };
  }

  const saved = result.discount + result.shippingDiscount;
  return {
    ok: true,
    code: voucher.code,
    type: voucher.type,
    // Tham so cong khai de giao dien tinh lai khi doi so luong, khong goi lai API.
    value: voucher.value,
    maxDiscount: voucher.maxDiscount,
    minOrderTotal: voucher.minOrderTotal,
    discount: result.discount,
    shippingDiscount: result.shippingDiscount,
    message:
      saved > 0
        ? `Đã áp dụng mã ${voucher.code}: giảm ${formatVnd(saved)} ₫`
        : `Đã áp dụng mã ${voucher.code} (${describeVoucher(voucher)})`,
  };
}
