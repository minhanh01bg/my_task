import { BRAND_COLORS } from "@/config/brand";
import { siteConfig } from "@/config/site";
import { getPublicStoreProfile } from "@/server/settings/store-settings";

/** Tên cửa hàng đổi trong admin → manifest cập nhật sau tối đa 1 giờ (ISR). */
export const revalidate = 3600;

const ICONS = [
  { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
  { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
  { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
] as const;

/** Manifest PWA của khu shop (POS/admin dùng `/manifest.webmanifest` tĩnh). */
export async function GET(): Promise<Response> {
  const { name } = await getPublicStoreProfile();

  const manifest = {
    name,
    short_name: name,
    description: siteConfig.description,
    start_url: "/shop",
    scope: "/shop",
    display: "standalone",
    lang: "vi",
    // Nền khớp token nền sáng (`viewport.themeColor`); theme_color là màu
    // thương hiệu, cùng giá trị với ảnh OG.
    background_color: "#faf7f2",
    theme_color: BRAND_COLORS.primary,
    icons: ICONS,
  };

  return new Response(JSON.stringify(manifest), {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
