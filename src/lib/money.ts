/**
 * Tien te trong he thong luon la so nguyen VND.
 * So luong co the la so thuc (kg, met), nhung ket qua nhan luon lam tron ve dong.
 */

/**
 * Tran cho moi so tien VND luu vao cot Prisma `Int` (32-bit, ke ca SQLite).
 * Lon hon thi khong ghi duoc: chan bang loi kiem tra (4xx) truoc khi ghi thay
 * vi de Prisma nem 500.
 */
export const MAX_INT_VND = 2_147_483_647;

export function roundVnd(value: number): number {
  return Math.round(value);
}

export function multiplyMoney(unitPrice: number, quantity: number): number {
  return roundVnd(unitPrice * quantity);
}

const VND_FORMATTER = new Intl.NumberFormat("vi-VN", {
  maximumFractionDigits: 0,
});

export function formatVnd(value: number): string {
  return VND_FORMATTER.format(value);
}
