import type { Prisma } from "@prisma/client";

/** Đơn đã thanh toán nhưng phải từng được tạo theo hình thức ghi nợ. */
export const settledDebtWhere = {
  status: "paid",
  payments: { some: { method: "debt" } },
} satisfies Prisma.OrderWhereInput;
