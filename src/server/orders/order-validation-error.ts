/**
 * Loi nghiep vu khi ghi don: so tien thanh toan khong khop tong do server tinh
 * lai, khach hang khong ton tai, so tien vuot cot Int... `/api/orders` tra 422
 * kem `message` tieng Viet; may ban giu don trong hang doi de chu cua hang xu
 * ly tay.
 */
export class OrderValidationError extends Error {
  constructor(
    public readonly code:
      | "PAYMENT_INVALID"
      | "PAYMENT_SHORT"
      | "PAYMENT_OVERPAID"
      | "CUSTOMER_NOT_FOUND"
      | "AMOUNT_TOO_LARGE",
    message: string,
  ) {
    super(message);
    this.name = "OrderValidationError";
  }
}
