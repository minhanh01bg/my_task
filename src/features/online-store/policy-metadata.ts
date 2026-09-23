import type { Metadata } from "next";

import { siteConfig } from "@/config/site";
import { storefrontOpenGraph } from "@/lib/seo/open-graph";
import { getPublicStoreProfile } from "@/server/settings/store-settings";

export interface PolicyPageMeta {
  /** Đường dẫn canonical, vd. `/shop/delivery-policy`. */
  path: string;
  title: string;
  description: string;
}

/**
 * Metadata chung cho trang chính sách: tiêu đề trang (template của
 * shop/layout nối tên cửa hàng), canonical và OpenGraph theo tên trong DB.
 */
export async function policyMetadata({
  path,
  title,
  description,
}: PolicyPageMeta): Promise<Metadata> {
  const storeProfile = await getPublicStoreProfile();

  return {
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
