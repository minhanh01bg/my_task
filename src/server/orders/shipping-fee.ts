/**
 * Phí giao hàng đơn online TRƯỚC khi áp voucher freeship (VND).
 * Hiện cửa hàng chưa thu phí ship nên luôn 0; khi có cài đặt phí ship chỉ cần
 * sửa ở đây — API kiểm tra mã và đường ghi đơn dùng chung một nguồn.
 */
export async function resolveShippingFee(): Promise<number> {
  return 0;
}
