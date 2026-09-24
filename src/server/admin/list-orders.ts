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
const PHONE_LIKE = /^\+?\d+$/;

/**
 * Tim don theo o tim kiem: ma don `DH…` → dung chinh xac `code` (unique);
 * dang so dien thoai (toan chu so, co the co `+` dau) → khop
 * `contactPhone` (don online) hoac so dien thoai khach hang lien ket
 * (don POS) bat dau bang q; neu q bat dau bang `+84` thi cung khop dang
 * `0…` tuong ung; con lai → `contains` tren ten lien he, ma don va ten
 * khach hang lien ket.
 */
export function buildOrderSearchWhere(
  rawQuery: string | undefined,
): Prisma.OrderWhereInput {
  const q = rawQuery?.trim() ?? "";
  if (!q) return {};
  if (ORDER_CODE_PATTERN.test(q)) return { code: q.toUpperCase() };
  if (PHONE_LIKE.test(q)) {
    const variants = q.startsWith("+84") ? [q, "0" + q.slice(3)] : [q];
    return {
      OR: variants.flatMap((variant) => [
        { contactPhone: { startsWith: variant } },
        { customer: { is: { phone: { startsWith: variant } } } },
      ]),
    };
  }
  return {
    OR: [
      { contactName: { contains: q } },
      { code: { contains: q } },
      { customer: { is: { name: { contains: q } } } },
    ],
  };
}

function parseValidDate(
  value: string | undefined,
  endOfDay = false,
): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const iso = endOfDay ? `${trimmed}T23:59:59.999` : `${trimmed}T00:00:00`;
  const date = new Date(iso);
  if (!isNaN(date.getTime())) {
    return date;
  }
  const fallback = new Date(trimmed);
  if (!isNaN(fallback.getTime())) {
    return fallback;
  }
  return null;
}

export function buildOrdersWhere(
  params: OrderListFilters & { q?: string },
): Prisma.OrderWhereInput {
  const status = params.status ?? "";
  const channel = params.channel ?? "";
  const start = parseValidDate(params.from, false);
  const end = parseValidDate(params.to, true);

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
