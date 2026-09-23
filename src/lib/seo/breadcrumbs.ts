import type { BreadcrumbItem } from "./json-ld";

/** Một mục breadcrumb: `path` tương đối (có thể kèm `#hash` cho link hiển thị). */
export interface StoreCrumb {
  name: string;
  path: string;
}

const HOME_CRUMB: StoreCrumb = { name: "Trang chủ", path: "/" };
const SHOP_CRUMB: StoreCrumb = { name: "Cửa hàng", path: "/shop" };

/** Trang chủ → Cửa hàng → ...`tail`. Dùng chung cho breadcrumb hiển thị và JSON-LD. */
export function storefrontCrumbs(...tail: StoreCrumb[]): StoreCrumb[] {
  return [HOME_CRUMB, SHOP_CRUMB, ...tail];
}

export interface CrumbProduct {
  id: string;
  name: string;
  category?: { id: string; name: string } | null;
}

/** Trang chủ → Cửa hàng → Danh mục (nếu có) → Sản phẩm. */
export function productCrumbs(product: CrumbProduct): StoreCrumb[] {
  return storefrontCrumbs(
    ...(product.category
      ? [
          {
            name: product.category.name,
            path: `/shop?category=${encodeURIComponent(product.category.id)}#catalog`,
          },
        ]
      : []),
    { name: product.name, path: `/shop/products/${product.id}` },
  );
}

/** URL tuyệt đối cho JSON-LD; bỏ `#hash` vì công cụ tìm kiếm không dùng fragment. */
export function toBreadcrumbItems(
  crumbs: readonly StoreCrumb[],
  baseUrl: string,
): BreadcrumbItem[] {
  return crumbs.map((crumb) => {
    const url = new URL(crumb.path, `${baseUrl}/`);
    url.hash = "";
    return { name: crumb.name, url: url.href };
  });
}
