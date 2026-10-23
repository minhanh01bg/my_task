import type { NextConfig } from "next";

import { buildCspHeaders } from "./src/server/security/csp";

const securityHeaders = [
  // No nonce: /shop and the other public pages are static/ISR.
  ...buildCspHeaders(),
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
  // Build kiểm chứng phải tách khỏi thư mục mà next start đang phục vụ.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  reactStrictMode: true,
  /*
   * Playwright goi qua 127.0.0.1; host khac localhost/127.0.0.1 bi Next chan tai
   * nguyen dev (trang khong hydrate). Host khac (IP LAN, tunnel) phai tu khai
   * trong DEV_ALLOWED_ORIGINS, cach nhau dau phay — khong mo san IP cong khai.
   */
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    ...(process.env.DEV_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  ],
  poweredByHeader: false,
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/shop/c/:slug",
          has: [
            { type: "query", key: "page", value: "(?<categoryPage>[1-9]\\d*)" },
          ],
          destination: "/shop/c/:slug/page/:categoryPage",
        },
      ],
    };
  },
  images: {
    formats: ["image/avif", "image/webp"],
    // 30 ngày: ảnh sản phẩm đổi thì đổi tên file (UUID) nên không sợ ảnh cũ.
    minimumCacheTTL: 2592000,
    // Mặc định Next lấy 50% dung lượng đĩa còn trống; vượt mức thì xóa ảnh ít dùng nhất.
    maximumDiskCacheSize: 200_000_000,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        // Chỉ URL ảnh Unsplash (/photo-<id>); thiếu pathname thì Next cho mọi đường dẫn.
        pathname: "/photo-*",
      },
    ],
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
