import { multiplyMoney, roundVnd } from "@/lib/money";

import type { CalculatedLine, CartLine, CartTotals } from "./types";

/**
 * Ham tinh tien DUY NHAT cua he thong — dung chung o client va server.
 *
 * Client goi de hien ngay cho khach xem; server goi lai tu dau khi nhan don
 * va con so cua server moi la con so that. Vi dung chung ham nay nen hai ket
 * qua luon khop.
 */
export function calculateCart(
  lines: CartLine[],
  orderDiscount = 0,
): CartTotals {
  const calculated: CalculatedLine[] = lines.map((line) => {
    const gross = multiplyMoney(line.unitPrice, line.quantity);
    const lineTotal = Math.max(0, gross - roundVnd(line.discount));
    return { ...line, lineTotal };
  });

  const subtotal = calculated.reduce((sum, line) => sum + line.lineTotal, 0);
  const discount = roundVnd(orderDiscount);
  const total = Math.max(0, subtotal - discount);

  return { lines: calculated, subtotal, discount, total };
}
