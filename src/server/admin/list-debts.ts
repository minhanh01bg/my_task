import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";
import { settledDebtWhere } from "@/server/debts/debt-filters";

import { paginate, type ListQuery, type PageResult } from "./pagination";

export const DEBTS_PAGE_SIZE = 50;
export const SETTLED_DEBTS_LIMIT = 20;

const openDebtWhere = { status: "debt" } satisfies Prisma.OrderWhereInput;

/** Chi tien khach that su da tra (tien mat/chuyen khoan da nhan). */
const receivedPaymentWhere = {
  method: { in: ["cash", "transfer"] },
  receivedAt: { not: null },
} satisfies Prisma.PaymentWhereInput;

const paymentHistory = {
  where: receivedPaymentWhere,
  orderBy: { createdAt: "desc" },
  select: {
    id: true,
    amount: true,
    method: true,
    receivedAt: true,
    createdAt: true,
  },
} satisfies Prisma.Order$paymentsArgs;

const debtOrderSelect = {
  id: true,
  code: true,
  total: true,
  customer: { select: { name: true, phone: true } },
  payments: paymentHistory,
} satisfies Prisma.OrderSelect;

type DebtOrder = Prisma.OrderGetPayload<{ select: typeof debtOrderSelect }>;

export type OpenDebtItem = DebtOrder & { paid: number; balance: number };
export type SettledDebtItem = DebtOrder & {
  paid: number;
  settledAt: Date | undefined;
};

export interface DebtCustomerBalance {
  key: string;
  name: string;
  balance: number;
}

function sumPaid(payments: { amount: number }[]): number {
  return payments.reduce((sum, payment) => sum + payment.amount, 0);
}

export async function listDebts(
  query: ListQuery,
): Promise<PageResult<OpenDebtItem>> {
  const result = await paginate(
    { page: query.page ?? 1, pageSize: query.pageSize ?? DEBTS_PAGE_SIZE },
    () => prisma.order.count({ where: openDebtWhere }),
    ({ skip, take }) =>
      prisma.order.findMany({
        where: openDebtWhere,
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        skip,
        take,
        select: debtOrderSelect,
      }),
  );

  return {
    ...result,
    items: result.items.map((order) => {
      const paid = sumPaid(order.payments);
      return { ...order, paid, balance: Math.max(0, order.total - paid) };
    }),
  };
}

/**
 * Tong con no theo khach tren TOAN BO don con no (khong theo trang). Chi doc
 * cot can cho phep cong — tong, khach, so tien da nhan.
 */
export async function summarizeOpenDebts(): Promise<DebtCustomerBalance[]> {
  const orders = await prisma.order.findMany({
    where: openDebtWhere,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      total: true,
      customerId: true,
      customer: { select: { name: true } },
      payments: { where: receivedPaymentWhere, select: { amount: true } },
    },
  });

  const byCustomer = new Map<string, DebtCustomerBalance>();
  for (const order of orders) {
    const key = order.customerId ?? "unknown";
    const balance = Math.max(0, order.total - sumPaid(order.payments));
    const current = byCustomer.get(key) ?? {
      key,
      name: order.customer?.name ?? "Khách lẻ",
      balance: 0,
    };
    byCustomer.set(key, { ...current, balance: current.balance + balance });
  }

  return [...byCustomer.values()];
}

export async function listSettledDebts(
  limit = SETTLED_DEBTS_LIMIT,
): Promise<SettledDebtItem[]> {
  const orders = await prisma.order.findMany({
    where: settledDebtWhere,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: debtOrderSelect,
  });

  return orders.map((order) => ({
    ...order,
    paid: sumPaid(order.payments),
    settledAt: order.payments[0]?.receivedAt ?? order.payments[0]?.createdAt,
  }));
}
