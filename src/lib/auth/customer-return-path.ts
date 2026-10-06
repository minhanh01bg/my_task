/** Chỉ cho phép quay lại trang đơn khách hàng sau đăng nhập. */
export function customerReturnPath(value?: string): string {
  if (
    value &&
    /^\/(?:orders\/guest\/[A-Za-z0-9_-]+|account\/orders(?:\/[A-Za-z0-9_-]+)?)$/.test(
      value,
    )
  ) {
    return value;
  }
  return "/account/orders";
}
