import { EmptyState } from "@/components/kit/empty-state";
import { Pagination } from "@/components/kit/pagination";
import type { StoreCrumb } from "@/lib/seo/breadcrumbs";
import { categoryHref } from "@/lib/seo/product-href";
import type { CategoryProductsPage } from "@/server/catalog/list-category-products";

import { CartFeedback } from "./cart-feedback";
import { ProductCard } from "./product-card";
import { StoreBreadcrumbs } from "./store-breadcrumbs";

export interface CategoryLandingProps {
  data: CategoryProductsPage;
  crumbs: StoreCrumb[];
  description: string;
}

/** Nội dung trang danh mục `/shop/c/[slug]`; cần OnlineCartProvider bọc ngoài. */
export function CategoryLanding({
  data,
  crumbs,
  description,
}: CategoryLandingProps) {
  const { category, products, total, page, pageSize } = data;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
      <CartFeedback />
      <StoreBreadcrumbs crumbs={crumbs} className="mb-6" />

      <header className="max-w-2xl">
        <p className="text-primary text-sm font-bold tracking-widest uppercase">
          Danh mục
        </p>
        <h1 className="font-heading mt-2 text-3xl font-bold sm:text-4xl">
          {category.name}
        </h1>
        <p className="text-muted-foreground mt-3 text-base">{description}</p>
      </header>

      {products.length > 0 ? (
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <EmptyState
          className="mt-8"
          title="Danh mục chưa có sản phẩm"
          description="Cửa hàng đang cập nhật hàng cho danh mục này, mời bạn xem các sản phẩm khác."
        />
      )}

      <Pagination
        pathname={categoryHref(category)}
        page={page}
        pageSize={pageSize}
        total={total}
        label={`Phân trang danh mục ${category.name}`}
        className="mt-8"
      />
    </div>
  );
}
