/** Cai dat phi giao hang don online (VND, so nguyen). */
export interface ShippingSettings {
  /** Phi giao tan noi khi don duoi nguong mien phi. */
  shippingFee: number;
  /** Tam tinh tu nguong nay tro len thi mien phi giao hang. */
  freeShippingThreshold: number;
}

export const DEFAULT_SHIPPING_SETTINGS: ShippingSettings = {
  shippingFee: 0,
  freeShippingThreshold: 200_000,
};

/**
 * Phi giao hang TRUOC voucher cho don giao tan noi. Don nhan tai cua hang
 * khong goi ham nay (phi luon 0). Dung chung cho server (tinh tien that) va
 * giao dien (hien thi) de hai ben khop nhau.
 */
export function computeShippingFee(
  subtotal: number,
  settings: ShippingSettings,
): number {
  const fee = Math.max(0, Math.round(settings.shippingFee));
  if (fee === 0) return 0;
  return Math.round(subtotal) >= settings.freeShippingThreshold ? 0 : fee;
}
