import { describe, expect, it } from "vitest";

import { generateMetadata } from "@/app/shop/page";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { siteConfig } from "@/config/site";

describe("Storefront SEO & Metadata (Task 13)", () => {
  describe("generateMetadata in /shop", () => {
    it("tạo metadata hoàn chỉnh với title, description, canonical và OpenGraph", async () => {
      const metadata = await generateMetadata();

      expect(metadata.title).toBeDefined();
      const titleText =
        typeof metadata.title === "string"
          ? metadata.title
          : typeof metadata.title === "object" &&
              metadata.title &&
              "default" in metadata.title
            ? String((metadata.title as { default: string }).default)
            : "";
      expect(titleText).toContain("Cửa hàng trực tuyến");
      expect(metadata.description).toBeDefined();
      expect(metadata.description).toContain("Mua sắm");

      // Canonical link
      expect(metadata.alternates?.canonical).toBe("/shop");

      // OpenGraph
      expect(metadata.openGraph).toBeDefined();
      const og = metadata.openGraph as {
        type?: string;
        url?: string;
        locale?: string;
      };
      expect(og.type).toBe("website");
      expect(og.url).toBe(`${siteConfig.url}/shop`);
      expect(og.locale).toBe("vi_VN");
    });

    it("không chứa query param, token hoặc PII trong canonical hoặc OpenGraph URL", async () => {
      const metadata = await generateMetadata();
      const canonical = String(metadata.alternates?.canonical || "");
      const ogUrl = String(metadata.openGraph?.url || "");

      expect(canonical).not.toMatch(/[?&#]/);
      expect(canonical).not.toContain("token");
      expect(canonical).not.toContain("nonce");

      expect(ogUrl).not.toMatch(/[?&#]/);
      expect(ogUrl).not.toContain("token");
      expect(ogUrl).not.toContain("nonce");
    });
  });

  describe("Robots Policy (src/app/robots.ts)", () => {
    it("cho phép trang công khai và chặn các trang quản trị, bảo mật và tra cứu đơn", () => {
      const policy = robots();

      const rules = Array.isArray(policy.rules)
        ? policy.rules[0]
        : policy.rules;
      expect(rules).toBeDefined();

      const disallow = Array.isArray(rules.disallow)
        ? rules.disallow
        : [rules.disallow];

      // Phải chặn các đường dẫn nhạy cảm
      expect(disallow).toContain("/admin/");
      expect(disallow).toContain("/api/");
      expect(disallow).toContain("/account/");
      expect(disallow).toContain("/checkout");
      expect(disallow).toContain("/order-success/");
      expect(disallow).toContain("/orders/guest/");

      // Sitemap phải trỏ đến URL tuyệt đối hợp lệ
      expect(policy.sitemap).toBe(`${siteConfig.url}/sitemap.xml`);
    });
  });

  describe("Sitemap Generation (src/app/sitemap.ts)", () => {
    it("tạo danh sách URL công khai với absolute URL và priority", async () => {
      const entries = await sitemap();

      const urls = entries.map((entry) => entry.url);
      expect(urls).toContain(`${siteConfig.url}/`);
      expect(urls).toContain(`${siteConfig.url}/shop`);
      expect(urls).toContain(`${siteConfig.url}/shop/delivery-policy`);
      expect(urls).toContain(`${siteConfig.url}/shop/payment-policy`);
      expect(urls).toContain(`${siteConfig.url}/shop/return-policy`);
      expect(urls).toContain(`${siteConfig.url}/shop/privacy`);

      // Không chứa URL riêng tư
      expect(urls.some((url) => url.includes("/admin"))).toBe(false);
      expect(urls.some((url) => url.includes("/checkout"))).toBe(false);
      expect(urls.some((url) => url.includes("/orders/guest"))).toBe(false);
    });
  });
});
