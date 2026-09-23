import type { Metadata } from "next";

import { env } from "./env";

const LOCAL_FALLBACK_URL = "http://localhost:3000";

type SiteUrlEnv = {
  NEXT_PUBLIC_APP_URL?: string;
  CANONICAL_ORIGIN?: string;
};

/** NEXT_PUBLIC_APP_URL → CANONICAL_ORIGIN → localhost; bỏ `/` cuối để ghép path. */
export function resolveSiteUrl(source: SiteUrlEnv): string {
  const url =
    source.NEXT_PUBLIC_APP_URL || source.CANONICAL_ORIGIN || LOCAL_FALLBACK_URL;
  return url.replace(/\/+$/, "");
}

export const siteConfig = {
  name: env.NEXT_PUBLIC_STORE_NAME ?? env.STORE_NAME ?? "Cửa hàng",
  description:
    "Cửa hàng tạp hoá trực tuyến: nhu yếu phẩm, thực phẩm, đồ tiêu dùng chính hãng. Đặt nhanh, giao tận nơi.",
  url: resolveSiteUrl(env),
  links: {
    docs: "https://nextjs.org/docs",
  },
};

/**
 * Tiêu đề trang theo tên cửa hàng. Template gốc đã nối `| siteConfig.name`,
 * nên chỉ khi tên trong DB khác tên cấu hình mới cần `absolute` để không
 * lặp hoặc lệch tên.
 */
export function storeTitle(page: string, storeName: string): Metadata["title"] {
  return storeName === siteConfig.name
    ? page
    : { absolute: `${page} | ${storeName}` };
}
