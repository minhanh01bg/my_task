/**
 * Loi nghiep vu khi doi trang thai don (huy, chuyen trang thai, danh dau da
 * thu tien). Server action quan tri bat loi nay va tra `{ ok: false, message }`
 * tieng Viet cho chu cua hang thay vi nem 500.
 */
export class OrderStatusError extends Error {
  constructor(
    public readonly code:
      | "ORDER_NOT_FOUND"
      | "ORDER_CANCELLED"
      | "ORDER_COMPLETED"
      | "INVALID_TRANSITION",
    message: string,
  ) {
    super(message);
    this.name = "OrderStatusError";
  }
}
