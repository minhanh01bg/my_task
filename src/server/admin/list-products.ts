import type { Prisma } from "@prisma/client";

import { normalizeSearchText } from "@/lib/search/search-text";
import { prisma } from "@/server/db/prisma";

import { paginate, type ListQuery, type PageResult } from "./pagination";

export const PRODUCTS_PAGE_SIZE = 50;
/** Con tu nguong nay tro xuong la "sap het" — giong canh bao tren trang. */
export const PRODUCT_LOW_STOCK_THRESHOLD = 5;

export type ProductStockStatus =
  | "all"
  | "low"
  | "out"
  | "negative"
  | "available";

export interface ProductListFilters {
  categoryId?: string;
  status?: ProductStockStatus;
}

export interface ProductStockCounts {
  all: number;
  low: number;
  out: number;
  negative: number;
  available: number;
}

const STOCK_STATUS_WHERE: Record<
  Exclude<ProductStockStatus, "all">,
  Prisma.ProductWhereInput
> = {
  low: { isService: false, stock: { lte: PRODUCT_LOW_STOCK_THRESHOLD } },
  out: { isService: false, stock: 0 },
  negative: { isService: false, stock: { lt: 0 } },
  available: { isService: false, stock: { gt: PRODUCT_LOW_STOCK_THRESHOLD } },
};

/** Cot du cho bang san pham, sua nhanh va dialog sua chi tiet. */
const adminProductSelect = {
  id: true,
  name: true,
  aliases: true,
  sku: true,
  categoryId: true,
  unit: true,
  stock: true,
  price: true,
  costPrice: true,
  imageUrl: true,
} satisfies Prisma.ProductSelect;

const adminProductListSelect = {
  ...adminProductSelect,
  category: { select: { name: true } },
} satisfies Prisma.ProductSelect;

export type AdminProductListItem = Prisma.ProductGetPayload<{
  select: typeof adminProductListSelect;
}>;

export type AdminEditableProduct = Prisma.ProductGetPayload<{
  select: typeof adminProductSelect;
}>;

export function isProductStockStatus(
  value: string | undefined,
): value is ProductStockStatus {
  return (
    value === "all" ||
    value === "low" ||
    value === "out" ||
    value === "negative" ||
    value === "available"
  );
}

function buildBaseWhere(
  rawQuery: string | undefined,
): Prisma.ProductWhereInput {
  const q = normalizeSearchText(rawQuery ?? "");
  return {
    deletedAt: null,
    ...(q ? { searchText: { contains: q } } : {}),
  };
}

export type ProductListResult = PageResult<AdminProductListItem> & {
  /** Dem theo o tim kiem (chua loc danh muc/trang thai) — cho cac tab loc. */
  counts: ProductStockCounts;
};

export async function listProducts(
  query: ListQuery<ProductListFilters>,
): Promise<ProductListResult> {
  const base = buildBaseWhere(query.q);
  const status = query.filters?.status ?? "all";
  const categoryId = query.filters?.categoryId;

  const where: Prisma.ProductWhereInput = {
    ...base,
    ...(categoryId && categoryId !== "all" ? { categoryId } : {}),
    ...(status !== "all" ? STOCK_STATUS_WHERE[status] : {}),
  };

  const [all, low, out, negative, available, result] = await Promise.all([
    prisma.product.count({ where: base }),
    prisma.product.count({ where: { ...base, ...STOCK_STATUS_WHERE.low } }),
    prisma.product.count({ where: { ...base, ...STOCK_STATUS_WHERE.out } }),
    prisma.product.count({
      where: { ...base, ...STOCK_STATUS_WHERE.negative },
    }),
    prisma.product.count({
      where: { ...base, ...STOCK_STATUS_WHERE.available },
    }),
    paginate(
      {
        page: query.page ?? 1,
        pageSize: query.pageSize ?? PRODUCTS_PAGE_SIZE,
      },
      () => prisma.product.count({ where }),
      ({ skip, take }) =>
        prisma.product.findMany({
          where,
          orderBy: [{ name: "asc" }, { id: "asc" }],
          skip,
          take,
          select: adminProductListSelect,
        }),
    ),
  ]);

  return { ...result, counts: { all, low, out, negative, available } };
}

export function listProductCategories() {
  return prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, sortOrder: true },
  });
}

export function findEditableProduct(
  id: string,
): Promise<AdminEditableProduct | null> {
  return prisma.product.findFirst({
    where: { id, deletedAt: null },
    select: adminProductSelect,
  });
}
