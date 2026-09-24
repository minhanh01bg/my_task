import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { JsonLdScript } from "@/components/seo/json-ld-script";
import { siteConfig } from "@/config/site";
import { OnlineCartProvider } from "@/features/online-store/cart-context";
import { CategoryLanding } from "@/features/online-store/category-landing";
import { StoreFooter } from "@/features/online-store/store-footer";
import { StoreHeader } from "@/features/online-store/store-header";
import { categoryCrumbs, toBreadcrumbItems } from "@/lib/seo/breadcrumbs";
import { breadcrumbJsonLd } from "@/lib/seo/json-ld";
import { storefrontOpenGraph } from "@/lib/seo/open-graph";
import { categoryHref } from "@/lib/seo/product-href";
import {
  listCategoryProducts,
  type CategoryProductsPage,
} from "@/server/catalog/list-category-products";
import { parsePageParam } from "@/server/admin/pagination";
import {
  getPublicStoreProfile,
  getShippingSettings,
} from "@/server/settings/store-settings";
import type { PublicStoreProfile } from "@/types/storefront";

/** Dữ liệu qua Data Cache (tag `catalog`, 60 giây) như trang sản phẩm. */
export const revalidate = 60;

/** Mảng rỗng: không prerender lúc build, render khi có request. */
export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string | string[] }>;
}

/** Trang 1 canonical không có query; trang sau tự tham chiếu `?page=N`. */
function canonicalPath(data: CategoryProductsPage): string {
  const base = categoryHref(data.category);
  return data.page > 1 ? `${base}?page=${data.page}` : base;
}

function categoryDescription(
  data: CategoryProductsPage,
  storeProfile: PublicStoreProfile,
): string {
  return `Mua ${data.category.name} tại ${storeProfile.name}: ${data.total} sản phẩm, giá và tồn kho cập nhật trực tiếp, đặt nhanh trực tuyến, giao hàng tận nơi.`;
}

async function loadPage({ params, searchParams }: CategoryPageProps) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const page = parsePageParam(query.page);
  const [data, storeProfile] = await Promise.all([
    listCategoryProducts(slug, page),
    getPublicStoreProfile(),
  ]);
  // Trang vượt quá số trang (trang 1 rỗng vẫn hợp lệ: danh mục chưa có hàng).
  const found = data && (data.page === 1 || data.products.length > 0);
  return { data: found ? data : null, storeProfile };
}

export async function generateMetadata(
  props: CategoryPageProps,
): Promise<Metadata> {
  const { data, storeProfile } = await loadPage(props);
  if (!data) {
    return {
      title: "Danh mục không tồn tại",
      description: "Không tìm thấy danh mục yêu cầu tại cửa hàng.",
    };
  }

  const path = canonicalPath(data);
  const title =
    data.page > 1
      ? `${data.category.name} - Trang ${data.page}`
      : data.category.name;
  const description = categoryDescription(data, storeProfile);

  return {
    // Template của shop/layout nối `| <tên cửa hàng trong DB>`.
    title,
    description,
    alternates: { canonical: path },
    openGraph: storefrontOpenGraph({
      title: `${title} | ${storeProfile.name}`,
      description,
      url: `${siteConfig.url}${path}`,
      siteName: storeProfile.name,
    }),
  };
}

export default async function CategoryPage(props: CategoryPageProps) {
  const { data, storeProfile } = await loadPage(props);
  if (!data) {
    notFound();
  }

  const crumbs = categoryCrumbs(data.category);
  const shipping = await getShippingSettings();

  return (
    <OnlineCartProvider>
      <JsonLdScript
        data={breadcrumbJsonLd(toBreadcrumbItems(crumbs, siteConfig.url))}
      />
      <StoreHeader storeName={storeProfile.name} shipping={shipping} />
      <main className="min-h-[70vh]">
        <CategoryLanding
          data={data}
          crumbs={crumbs}
          description={categoryDescription(data, storeProfile)}
        />
      </main>
      <StoreFooter profile={storeProfile} />
    </OnlineCartProvider>
  );
}
