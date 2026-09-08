import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

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
      ],
    },
    sitemap: `${siteConfig.url}/sitemap.xml`,
  };
}
