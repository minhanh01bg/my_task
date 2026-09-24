import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";

import {
  ProductPage,
  productPageMetadata,
} from "@/features/online-store/product-page";
import { productHref } from "@/lib/seo/product-href";
import { getOnlineProductDetail } from "@/server/catalog/get-product-detail";
import {
  getPublicStoreProfile,
  getShippingSettings,
} from "@/server/settings/store-settings";

/** ISR: HTML không phụ thuộc cookie; tag cache (Task 4) lo invalidation. */
export const revalidate = 60;

/** Mảng rỗng: không prerender lúc build, render lần đầu khi có request rồi cache (ISR). */
export function generateStaticParams(): Array<{ id: string }> {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const [detail, storeProfile] = await Promise.all([
    getOnlineProductDetail(id),
    getPublicStoreProfile(),
  ]);
  return productPageMetadata(detail, storeProfile);
}

/**
 * URL cũ theo id: sản phẩm đã có slug → 308 sang `/shop/p/<slug>` (link cũ,
 * bookmark, localStorage vẫn chạy); chưa có slug thì render như trước.
 */
export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Cùng loader `cache()` với generateMetadata → một truy vấn mỗi request.
  const [detail, storeProfile, shipping] = await Promise.all([
    getOnlineProductDetail(id),
    getPublicStoreProfile(),
    getShippingSettings(),
  ]);

  if (!detail) {
    notFound();
  }
  if (detail.product.slug) {
    permanentRedirect(productHref(detail.product));
  }

  return (
    <ProductPage
      detail={detail}
      storeProfile={storeProfile}
      shipping={shipping}
    />
  );
}
