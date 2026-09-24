import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/** Render theo request để host lúc build (có thể là dummy) không bị đóng băng. */
export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin/",
        "/api/",
        "/account/",
        "/checkout",
        "/order-success/",
        "/orders/guest/",
        "/login",
        "/pos",
        "/dev/",
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
