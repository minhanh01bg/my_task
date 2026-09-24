import type { NextConfig } from "next";

import { buildCspHeader } from "./src/server/security/csp";

const cspResult = buildCspHeader();
const cspHeaders =
  cspResult.headerName && cspResult.headerValue
    ? [{ key: cspResult.headerName, value: cspResult.headerValue }]
    : [];

const securityHeaders = [
  ...cspHeaders,
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "X-DNS-Prefetch-Control",
    value: "off",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /*
   * Playwright goi qua 127.0.0.1 con `next dev` phuc vu localhost, nen Next
   * coi la cross-origin va chan tai nguyen dev — trang khong hydrate duoc va
   * form submit kieu native.
   */
  allowedDevOrigins: ["127.0.0.1", "160.250.247.137"],
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    // 30 ngày: ảnh sản phẩm đổi thì đổi tên file (UUID) nên không sợ ảnh cũ.
    minimumCacheTTL: 2592000,
  },
  async redirects() {
    return [
      {
        // Điểm vào công khai là cửa hàng; POS vẫn ở /pos (sau đăng nhập).
        source: "/",
        destination: "/shop",
        permanent: true,
      },
      {
        source: "/admin/login",
        destination: "/login",
        permanent: false,
      },
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
      {
        // save-image.ts đặt tên file bằng randomUUID() → nội dung không bao giờ
        // đổi dưới cùng URL. Không áp cho /products/* vì ảnh mẫu đặt tên theo slug.
        source: "/uploads/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      {
        source: "/order-success/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "private, no-store",
          },
          {
            key: "Referrer-Policy",
            value: "no-referrer",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
