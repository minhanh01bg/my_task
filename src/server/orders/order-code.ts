/**
 * Ma don hien thi cho khach — cung la noi dung chuyen khoan VietQR,
 * nen phai ngan va de doc.
 */
export function generateOrderCode(sequence: number): string {
  return `DH${String(sequence).padStart(4, "0")}`;
}
