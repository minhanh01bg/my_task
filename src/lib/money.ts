/**
 * Tien te trong he thong luon la so nguyen VND.
 * So luong co the la so thuc (kg, met), nhung ket qua nhan luon lam tron ve dong.
 */

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
