import type { OnlineCatalog } from "@/features/online-store/types";

export interface PreviewSlide {
  id: string;
  productName: string;
  imageUrl: string;
  price: number;
  unit: string;
  categoryName: string;
  categoryHref: string;
  productHref: string;
}

export function buildPreviewSlides(catalog: OnlineCatalog): PreviewSlide[] {
  const candidates = catalog.products.filter((product) => product.imageUrl);
  const seenCategories = new Set<string | null>();
  const firstByCategory = candidates.filter((product) => {
    if (seenCategories.has(product.categoryId)) return false;
    seenCategories.add(product.categoryId);
    return true;
  });
  const selectedIds = new Set(firstByCategory.map((product) => product.id));
  const selected = [
    ...firstByCategory,
    ...candidates.filter((product) => !selectedIds.has(product.id)),
  ].slice(0, 5);
  return selected.map((product) => {
    const category = catalog.categories.find(
      (item) => item.id === product.categoryId,
    );
    return {
      id: product.id,
      productName: product.name,
      imageUrl: product.imageUrl!,
      price: product.price,
      unit: product.unit,
      categoryName: category?.name ?? "Sản phẩm tuyển chọn",
      categoryHref: category?.slug
        ? `/shop/c/${category.slug}`
        : category
          ? `/shop?category=${encodeURIComponent(category.id)}`
          : "/shop#catalog",
      productHref: product.slug
        ? `/shop/p/${product.slug}`
        : `/shop/products/${encodeURIComponent(product.id)}`,
    };
  });
}
