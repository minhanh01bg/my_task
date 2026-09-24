import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  ProductPage,
  productPageMetadata,
} from "@/features/online-store/product-page";
import { getOnlineProductDetailBySlug } from "@/server/catalog/get-product-detail";
import {
  getPublicStoreProfile,
  getShippingSettings,
} from "@/server/settings/store-settings";

/** ISR như trang theo id; slug đổi (đổi tên) → tag `catalog` làm mới. */
export const revalidate = 60;

/** Mảng rỗng: không prerender lúc build, render lần đầu khi có request rồi cache (ISR). */
export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const [detail, storeProfile] = await Promise.all([
    getOnlineProductDetailBySlug(slug),
    getPublicStoreProfile(),
  ]);
  return productPageMetadata(detail, storeProfile);
}

/** Trang sản phẩm canonical `/shop/p/<slug>`. */
export default async function ProductBySlugPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [detail, storeProfile, shipping] = await Promise.all([
    getOnlineProductDetailBySlug(slug),
    getPublicStoreProfile(),
    getShippingSettings(),
  ]);

  if (!detail) {
    notFound();
  }

  return (
    <ProductPage
      detail={detail}
      storeProfile={storeProfile}
      shipping={shipping}
    />
  );
}
