import { ImageResponse } from "next/og";

import { siteConfig } from "@/config/site";
import { getPublicStoreProfile } from "@/server/settings/store-settings";

export const runtime = "nodejs";
/** Tên cửa hàng đổi trong admin → ảnh OG cập nhật sau tối đa 1 giờ. */
export const revalidate = 3600;

export const alt = "Cửa hàng tạp hoá trực tuyến";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Font mặc định của next/og (Geist Regular) có đủ dấu tiếng Việt. Không in
 * host: ảnh prerender lúc build có thể mang host dummy tới 1 giờ.
 *
 * Satori không đọc được CSS variable: giá trị hex quy đổi từ token trong
 * globals.css (light) — `--primary` oklch(0.38 0.075 153), `--primary-foreground`
 * oklch(0.985 0.005 82), `--accent` oklch(0.72 0.115 73).
 */
const BRAND = {
  primary: "#1d4e2f",
  primaryForeground: "#fcfaf6",
  accent: "#d0994c",
} as const;

export default async function OpengraphImage() {
  const { name } = await getPublicStoreProfile();

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 48,
        padding: "72px 80px",
        backgroundColor: BRAND.primary,
        color: BRAND.primaryForeground,
      }}
    >
      <div
        style={{
          display: "flex",
          width: 96,
          height: 12,
          borderRadius: 6,
          backgroundColor: BRAND.accent,
        }}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
        <div
          style={{
            display: "flex",
            fontSize: 88,
            lineHeight: 1.1,
            letterSpacing: -2,
          }}
        >
          {name}
        </div>
        <div
          style={{
            display: "flex",
            fontSize: 36,
            lineHeight: 1.35,
            opacity: 0.85,
            maxWidth: 960,
          }}
        >
          {siteConfig.description}
        </div>
      </div>
    </div>,
    size,
  );
}
