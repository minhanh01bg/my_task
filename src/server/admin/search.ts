import type { Prisma } from "@prisma/client";

import { normalizeSearchText } from "@/lib/search/search-text";
import { prisma } from "@/server/db/prisma";

import { buildOrderSearchWhere } from "./list-orders";

/** Moi nhom chi hien vai dong — palette de nhay, khong phai trang danh sach. */
export const ADMIN_SEARCH_GROUP_LIMIT = 5;
export const ADMIN_SEARCH_MAX_QUERY_LENGTH = 100;

export interface AdminSearchProduct {
  id: string;
  name: string;
  sku: string | null;
  href: string;
}

export interface AdminSearchOrder {
  id: string;
  code: string;
  /** Ten lien he (don online) hoac ten khach lien ket (don POS). */
  customerName: string | null;
  total: number;
  href: string;
}

export interface AdminSearchCustomer {
  id: string;
  displayName: string;
  phone: string;
  href: string;
}

export interface AdminSearchResults {
  products: AdminSearchProduct[];
  orders: AdminSearchOrder[];
  customers: AdminSearchCustomer[];
}

const PHONE_LIKE = /^\+?\d+$/;

const productSelect = {
  id: true,
  name: true,
  sku: true,
} satisfies Prisma.ProductSelect;

const orderSelect = {
  id: true,
  code: true,
  total: true,
  contactName: true,
  customer: { select: { name: true } },
} satisfies Prisma.OrderSelect;

/** Tuyet doi khong them `passwordHash` vao day. */
const customerSelect = {
  id: true,
  displayName: true,
  phoneNormalized: true,
} satisfies Prisma.CustomerAccountSelect;

function buildCustomerSearchWhere(q: string): Prisma.CustomerAccountWhereInput {
  if (PHONE_LIKE.test(q)) {
    const variants = q.startsWith("+84") ? [q, "0" + q.slice(3)] : [q];
    return {
      OR: variants.map((variant) => ({
        phoneNormalized: { startsWith: variant },
      })),
    };
  }
  return {
    OR: [
      { displayName: { contains: q } },
      { phoneNormalized: { contains: q } },
    ],
  };
}

/**
 * Tim toan cuc cho palette Ctrl+K: san pham (searchText da chuan hoa),
 * don hang (cung luat voi o tim trang Don hang) va tai khoan khach.
 */
export async function searchAdmin(
  rawQuery: string,
): Promise<AdminSearchResults> {
  const q = rawQuery.trim().slice(0, ADMIN_SEARCH_MAX_QUERY_LENGTH);
  const normalized = normalizeSearchText(q);
  if (!q || !normalized) return { products: [], orders: [], customers: [] };

  const [products, orders, customers] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: null, searchText: { contains: normalized } },
      orderBy: [{ soldCount: "desc" }, { name: "asc" }, { id: "asc" }],
      take: ADMIN_SEARCH_GROUP_LIMIT,
      select: productSelect,
    }),
    prisma.order.findMany({
      where: buildOrderSearchWhere(q),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: ADMIN_SEARCH_GROUP_LIMIT,
      select: orderSelect,
    }),
    prisma.customerAccount.findMany({
      where: buildCustomerSearchWhere(q),
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: ADMIN_SEARCH_GROUP_LIMIT,
      select: customerSelect,
    }),
  ]);

  return {
    products: products.map((product) => ({
      id: product.id,
      name: product.name,
      sku: product.sku,
      href: `/admin/products?q=${encodeURIComponent(product.name)}&edit=${encodeURIComponent(product.id)}`,
    })),
    orders: orders.map((order) => ({
      id: order.id,
      code: order.code,
      customerName: order.contactName ?? order.customer?.name ?? null,
      total: order.total,
      href: `/admin/orders/${encodeURIComponent(order.id)}`,
    })),
    customers: customers.map((customer) => ({
      id: customer.id,
      displayName: customer.displayName,
      phone: customer.phoneNormalized,
      href: `/admin/orders?q=${encodeURIComponent(customer.phoneNormalized)}`,
    })),
  };
}
