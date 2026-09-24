import type { BreadcrumbItem } from "./json-ld";
import { categoryHref, productHref, type HrefCategory } from "./product-href";

/** Một mục breadcrumb: `path` tương đối (có thể kèm `#hash` cho link hiển thị). */
export interface StoreCrumb {
  name: string;
  path: string;
}

/**
 * Gốc là /shop: `/` chỉ chuyển hướng 308 sang /shop nên không làm một cấp
 * riêng (trùng URL, lãng phí một cấp trong BreadcrumbList).
 */
const SHOP_CRUMB: StoreCrumb = { name: "Cửa hàng", path: "/shop" };

/** Cửa hàng → ...`tail`. Dùng chung cho breadcrumb hiển thị và JSON-LD. */
export function storefrontCrumbs(...tail: StoreCrumb[]): StoreCrumb[] {
  return [SHOP_CRUMB, ...tail];
}

export interface CrumbCategory extends HrefCategory {
  name: string;
}

export interface CrumbProduct {
  id: string;
  name: string;
  slug?: string | null;
  category?: CrumbCategory | null;
}

function categoryCrumb(category: CrumbCategory): StoreCrumb {
  return { name: category.name, path: categoryHref(category) };
}

/** Cửa hàng → Danh mục. */
export function categoryCrumbs(category: CrumbCategory): StoreCrumb[] {
  return storefrontCrumbs(categoryCrumb(category));
}

/** Cửa hàng → Danh mục (nếu có) → Sản phẩm. */
export function productCrumbs(product: CrumbProduct): StoreCrumb[] {
  return storefrontCrumbs(
    ...(product.category ? [categoryCrumb(product.category)] : []),
    { name: product.name, path: productHref(product) },
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
