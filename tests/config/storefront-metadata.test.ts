import type { Metadata } from "next";
import { describe, expect, it, vi } from "vitest";

import { metadata as checkoutMetadata } from "@/app/checkout/page";
import { metadata as accountLoginMetadata } from "@/app/account/login/page";
import { metadata as accountOrderMetadata } from "@/app/account/orders/[id]/page";
import { metadata as accountOrdersMetadata } from "@/app/account/orders/page";
import { metadata as accountRegisterMetadata } from "@/app/account/register/page";
import { metadata as rootMetadata, viewport } from "@/app/layout";
import { generateMetadata as loginMetadata } from "@/app/login/page";
import { metadata as posMetadata } from "@/app/pos/layout";
import { metadata as shopLayoutMetadata } from "@/app/shop/layout";
import { generateMetadata } from "@/app/shop/page";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { siteConfig, storeTitle } from "@/config/site";

vi.mock("next/font/google", () => {
  const font = () => ({ variable: "font-mock", className: "font-mock" });
  return { Be_Vietnam_Pro: font, Geist_Mono: font };
});
vi.mock("@/app/globals.css", () => ({}));

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
      const absoluteTitle =
        typeof metadata.title === "object" &&
        metadata.title &&
        "absolute" in metadata.title
          ? String(metadata.title.absolute)
          : "";
      expect(titleText || absoluteTitle).toContain("Cửa hàng trực tuyến");
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
      expect(disallow).toContain("/login");
      expect(disallow).toContain("/pos");
      expect(disallow).toContain("/dev/");

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

  describe("Root layout metadata", () => {
    it("dùng template tiêu đề theo tên cửa hàng, OpenGraph, Twitter và index mặc định", () => {
      expect(rootMetadata.title).toEqual({
        default: siteConfig.name,
        template: `%s | ${siteConfig.name}`,
      });
      expect(rootMetadata.openGraph).toMatchObject({
        siteName: siteConfig.name,
        locale: "vi_VN",
        type: "website",
      });
      expect(rootMetadata.twitter).toMatchObject({
        card: "summary_large_image",
      });
      expect(rootMetadata.robots).toMatchObject({ index: true, follow: true });
      // Manifest do layout POS / shop tự khai báo.
      expect(rootMetadata.manifest).toBeUndefined();
    });

    it("export viewport với themeColor cho chế độ sáng và tối", () => {
      expect(viewport.themeColor).toEqual([
        { media: "(prefers-color-scheme: light)", color: "#faf7f2" },
        { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
      ]);
    });
  });

  describe("Manifest theo khu vực", () => {
    it("POS dùng manifest.webmanifest, shop dùng shop.webmanifest", () => {
      expect(posMetadata.manifest).toBe("/manifest.webmanifest");
      expect(shopLayoutMetadata.manifest).toBe("/shop.webmanifest");
    });
  });

  describe("storeTitle", () => {
    it("để template gốc thêm tên khi tên cửa hàng trùng siteConfig.name", () => {
      expect(storeTitle("Cửa hàng trực tuyến", siteConfig.name)).toBe(
        "Cửa hàng trực tuyến",
      );
    });

    it("dùng title.absolute khi tên cửa hàng trong DB khác siteConfig.name", () => {
      expect(storeTitle("Cửa hàng trực tuyến", "Tạp hoá Khác")).toEqual({
        absolute: "Cửa hàng trực tuyến | Tạp hoá Khác",
      });
    });
  });

  describe("Trang riêng tư không được index", () => {
    const noindex = { index: false, follow: false };

    it.each<[string, Metadata]>([
      ["/checkout", checkoutMetadata],
      ["/account/login", accountLoginMetadata],
      ["/account/register", accountRegisterMetadata],
      ["/account/orders", accountOrdersMetadata],
      ["/account/orders/[id]", accountOrderMetadata],
    ])("%s đặt robots noindex, nofollow", (_path, metadata) => {
      expect(metadata.robots).toEqual(noindex);
    });

    it("/login đặt robots noindex, nofollow", async () => {
      const metadata = await loginMetadata();
      expect(metadata.robots).toEqual(noindex);
    });
  });
});
