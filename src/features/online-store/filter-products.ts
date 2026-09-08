import { normalize } from "@/lib/search/normalize";
import type { CatalogFilter } from "@/types/storefront";

import type { OnlineProduct } from "./types";

export function filterAndSortProducts(
  products: OnlineProduct[],
  filter: CatalogFilter,
): OnlineProduct[] {
  const queryNormalized = normalize(filter.q || "");
  const tokens = queryNormalized.split(/\s+/).filter(Boolean);

  const filtered = products.filter((product) => {
    // 1. Lọc theo danh mục
    if (filter.category && product.categoryId !== filter.category) {
      return false;
    }

    // 2. Lọc theo trạng thái còn hàng
    if (filter.inStock && product.stock <= 0) {
      return false;
    }

    // 3. Lọc theo khoảng giá tối thiểu
    if (filter.minPrice !== null && product.price < filter.minPrice) {
      return false;
    }

    // 4. Lọc theo khoảng giá tối đa
    if (filter.maxPrice !== null && product.price > filter.maxPrice) {
      return false;
    }

    // 5. Tìm kiếm theo từ khóa (AND semantics)
    if (tokens.length > 0) {
      const productHaystack = normalize(
        `${product.name} ${product.searchText}`,
      );
      const matchesAllTokens = tokens.every((token) =>
        productHaystack.includes(token),
      );
      if (!matchesAllTokens) {
        return false;
      }
    }

    return true;
  });

  // Sắp xếp
  const sorted = [...filtered].sort((a, b) => {
    switch (filter.sort) {
      case "price-asc": {
        const diff = a.price - b.price;
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
      }
      case "price-desc": {
        const diff = b.price - a.price;
        return diff !== 0 ? diff : a.id.localeCompare(b.id);
      }
      case "name-asc": {
        const comp = a.name.localeCompare(b.name, "vi", {
          sensitivity: "base",
        });
        return comp !== 0 ? comp : a.id.localeCompare(b.id);
      }
      case "relevance":
      default: {
        if (tokens.length > 0) {
          const normA = normalize(a.name);
          const normB = normalize(b.name);
          const aNameMatch = normA.includes(queryNormalized) ? 1 : 0;
          const bNameMatch = normB.includes(queryNormalized) ? 1 : 0;
          if (aNameMatch !== bNameMatch) {
            return bNameMatch - aNameMatch;
          }
        }
        return a.id.localeCompare(b.id);
      }
    }
  });

  return sorted;
}
