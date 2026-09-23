import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";
import { listSitemapProducts } from "@/server/catalog/list-sitemap-products";

/**
 * Render theo request: build không có CANONICAL_ORIGIN thật (dùng host dummy)
 * sẽ không đóng băng host sai vào sitemap. Dữ liệu sản phẩm đã có Data Cache.
 */
export const dynamic = "force-dynamic";

const POLICY_PATHS = [
  "/shop/delivery-policy",
  "/shop/payment-policy",
  "/shop/return-policy",
  "/shop/privacy",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = siteConfig.url;
  const products = await listSitemapProducts();

  // Trang tĩnh không có ngày sửa thật → bỏ lastModified thay vì ghi "now".
  // `/` không vào sitemap vì chuyển hướng vĩnh viễn sang /shop.
  return [
    { url: `${baseUrl}/shop`, changeFrequency: "daily", priority: 0.9 },
    ...POLICY_PATHS.map((path) => ({
      url: `${baseUrl}${path}`,
      changeFrequency: "monthly" as const,
      priority: 0.5,
    })),
    ...products.map((product) => ({
      url: `${baseUrl}/shop/products/${product.id}`,
      lastModified: new Date(product.updatedAt),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    })),
  ];
}
