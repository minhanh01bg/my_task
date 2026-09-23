import type { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";

import { paginate, type ListQuery, type PageResult } from "./pagination";

export const CUSTOMERS_PAGE_SIZE = 50;

/** Tuyet doi khong them `passwordHash` vao day. */
const adminCustomerListSelect = {
  id: true,
  displayName: true,
  phoneNormalized: true,
  createdAt: true,
  disabledAt: true,
  _count: { select: { orders: true } },
} satisfies Prisma.CustomerAccountSelect;

export type AdminCustomerListItem = Prisma.CustomerAccountGetPayload<{
  select: typeof adminCustomerListSelect;
}>;

export function listCustomers(
  query: ListQuery,
): Promise<PageResult<AdminCustomerListItem>> {
  const q = query.q?.trim() ?? "";
  const where: Prisma.CustomerAccountWhereInput = q
    ? {
        OR: [
          { displayName: { contains: q } },
          { phoneNormalized: { contains: q } },
        ],
      }
    : {};

  return paginate(
    { page: query.page ?? 1, pageSize: query.pageSize ?? CUSTOMERS_PAGE_SIZE },
    () => prisma.customerAccount.count({ where }),
    ({ skip, take }) =>
      prisma.customerAccount.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip,
        take,
        select: adminCustomerListSelect,
      }),
  );
}
