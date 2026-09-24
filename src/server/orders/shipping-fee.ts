import { computeShippingFee } from "@/lib/shipping/shipping-fee";
import { getShippingSettings } from "@/server/settings/store-settings";

/**
 * Phi giao hang don online giao tan noi TRUOC khi ap voucher freeship (VND):
 * `store.shippingFee` khi tam tinh duoi `store.freeShippingThreshold`, nguoc
 * lai 0. API kiem tra ma va duong ghi don dung chung nguon nay. Don nhan tai
 * cua hang KHONG goi ham nay — phi luon 0.
 */
export async function resolveShippingFee(subtotal: number): Promise<number> {
  return computeShippingFee(subtotal, await getShippingSettings());
}
