/** Sản phẩm tối thiểu để dựng link; `slug` có thể thiếu ở dữ liệu cũ/localStorage. */
export interface HrefProduct {
  id: string;
  slug?: string | null;
}

export interface HrefCategory {
  id: string;
  slug?: string | null;
}

/** `/shop/p/<slug>` khi có slug, không thì `/shop/products/<id>` (tự chuyển hướng). */
export function productHref(product: HrefProduct): string {
  return product.slug
    ? `/shop/p/${product.slug}`
    : `/shop/products/${product.id}`;
}

/** Trang danh mục `/shop/c/<slug>`; chưa có slug thì bộ lọc trên /shop. */
export function categoryHref(category: HrefCategory): string {
  return category.slug
    ? `/shop/c/${category.slug}`
    : `/shop?category=${encodeURIComponent(category.id)}#catalog`;
}
