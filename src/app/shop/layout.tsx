import type { Metadata } from "next";

import { DEFAULT_OG_IMAGE } from "@/lib/seo/open-graph";
import { getPublicStoreProfile } from "@/server/settings/store-settings";

/**
 * Template tiêu đề của khu shop theo tên cửa hàng trong DB (không phải env),
 * áp cho trang con: sản phẩm, chính sách. Trang `/shop` cùng segment với
 * layout nên Next không áp template này — trang đó tự đặt `title.absolute`.
 */
export async function generateMetadata(): Promise<Metadata> {
  const { name } = await getPublicStoreProfile();

  return {
    title: { default: name, template: `%s | ${name}` },
    manifest: "/shop.webmanifest",
    openGraph: {
      siteName: name,
      locale: "vi_VN",
      type: "website",
      images: [DEFAULT_OG_IMAGE],
    },
  };
}

export default function ShopLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
