import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";

import { paginate, type ListQuery, type PageResult } from "./pagination";

export const ORDERS_PAGE_SIZE = 20;

export interface OrderListFilters {
  status?: string;
  channel?: string;
  /** YYYY-MM-DD */
  from?: string;
  /** YYYY-MM-DD */
  to?: string;
}

const ORDER_CODE_PATTERN = /^DH\d+$/i;
const DIGITS_ONLY = /^\d+$/;

/**
 * Tim don theo o tim kiem: ma don `DH…` → dung chinh xac `code` (unique);
 * toan chu so → so dien thoai lien he bat dau bang q; con lai → `contains`
 * tren ten lien he va ma don.
 */
export function buildOrderSearchWhere(
  rawQuery: string | undefined,
): Prisma.OrderWhereInput {
  const q = rawQuery?.trim() ?? "";
  if (!q) return {};
  if (ORDER_CODE_PATTERN.test(q)) return { code: q.toUpperCase() };
  if (DIGITS_ONLY.test(q)) return { contactPhone: { startsWith: q } };
  return {
    OR: [{ contactName: { contains: q } }, { code: { contains: q } }],
  };
}

export function buildOrdersWhere(
  params: OrderListFilters & { q?: string },
): Prisma.OrderWhereInput {
  const status = params.status ?? "";
  const channel = params.channel ?? "";
  const from = params.from ?? "";
  const to = params.to ?? "";
  const start = from ? new Date(`${from}T00:00:00`) : null;
  const end = to ? new Date(`${to}T23:59:59.999`) : null;

  return {
    ...(channel ? { channel } : {}),
    ...(status ? { status } : {}),
    ...(start || end
      ? {
          createdAt: {
            ...(start ? { gte: start } : {}),
            ...(end ? { lte: end } : {}),
          },
        }
      : {}),
    ...buildOrderSearchWhere(params.q),
  };
}

const adminOrderListSelect = {
  id: true,
  code: true,
  status: true,
  channel: true,
  fulfillmentStatus: true,
  hasStockWarning: true,
  createdAt: true,
  total: true,
  customer: { select: { name: true, phone: true } },
  items: { select: { nameSnapshot: true, quantity: true } },
} satisfies Prisma.OrderSelect;

export type AdminOrderListItem = Prisma.OrderGetPayload<{
  select: typeof adminOrderListSelect;
}>;

export function listOrders(
  query: ListQuery<OrderListFilters>,
): Promise<PageResult<AdminOrderListItem>> {
  const where = buildOrdersWhere({ ...query.filters, q: query.q });

  return paginate(
    { page: query.page ?? 1, pageSize: query.pageSize ?? ORDERS_PAGE_SIZE },
    () => prisma.order.count({ where }),
    ({ skip, take }) =>
      prisma.order.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take,
        select: adminOrderListSelect,
      }),
  );
}
