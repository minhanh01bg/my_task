/**
 * Đơn khách, đơn tài khoản, hoặc trang sản phẩm (đăng nhập để nhận báo có hàng).
 * Slug tối đa 80 ký tự, id sản phẩm tối đa 64 — cùng định dạng route-params.
 */
const CUSTOMER_RETURN_PATH =
  /^\/(?:orders\/guest\/[A-Za-z0-9_-]+|account\/orders(?:\/[A-Za-z0-9_-]+)?|shop\/p\/(?=[a-z0-9-]{1,80}$)[a-z0-9]+(?:-[a-z0-9]+)*|shop\/products\/[A-Za-z0-9_-]{1,64})$/;

/** Chỉ cho phép quay lại các trang khách trong danh sách trên sau đăng nhập. */
export function customerReturnPath(value?: string): string {
  if (value && value.length <= 100 && CUSTOMER_RETURN_PATH.test(value)) {
    return value;
  }
  return "/account/orders";
}
