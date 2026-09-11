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
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
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
