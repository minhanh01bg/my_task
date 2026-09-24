import type { Metadata } from "next";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { metadata as checkoutMetadata } from "@/app/checkout/page";
import { metadata as accountLoginMetadata } from "@/app/account/login/page";
import { metadata as accountOrderMetadata } from "@/app/account/orders/[id]/page";
import { metadata as accountOrdersMetadata } from "@/app/account/orders/page";
import { metadata as accountRegisterMetadata } from "@/app/account/register/page";
import { metadata as rootMetadata, viewport } from "@/app/layout";
import { generateMetadata as loginMetadata } from "@/app/login/page";
import { metadata as posMetadata } from "@/app/pos/layout";
import { generateMetadata as deliveryPolicyMetadata } from "@/app/shop/delivery-policy/page";
import { generateMetadata as shopLayoutMetadata } from "@/app/shop/layout";
import { generateMetadata } from "@/app/shop/page";
import { generateMetadata as paymentPolicyMetadata } from "@/app/shop/payment-policy/page";
import { generateMetadata as privacyPolicyMetadata } from "@/app/shop/privacy/page";
import { generateMetadata as productMetadata } from "@/app/shop/products/[id]/page";
import { generateMetadata as productSlugMetadata } from "@/app/shop/p/[slug]/page";
import * as deliveryPolicyModule from "@/app/shop/delivery-policy/page";
import * as paymentPolicyModule from "@/app/shop/payment-policy/page";
import * as privacyPolicyModule from "@/app/shop/privacy/page";
import * as returnPolicyModule from "@/app/shop/return-policy/page";
import { generateMetadata as returnPolicyMetadata } from "@/app/shop/return-policy/page";
import * as robotsModule from "@/app/robots";
import * as sitemapModule from "@/app/sitemap";
import { siteConfig, storeTitle } from "@/config/site";
import { prisma } from "@/server/db/prisma";

const robots = robotsModule.default;
const sitemap = sitemapModule.default;

const DB_STORE_NAME = "Tạp hoá Minh An SEO";
const SEO_PRODUCT_ID = "test-seo-sitemap-01";
const SEO_PRODUCT_NO_IMAGE_ID = "test-seo-sitemap-02";
const SEO_INACTIVE_ID = "test-seo-sitemap-inactive";
const SEO_DELETED_ID = "test-seo-sitemap-deleted";
const SEO_SLUG_PRODUCT_ID = "test-seo-sitemap-slug";
const SEO_PRODUCT_IDS = [
  SEO_PRODUCT_ID,
  SEO_PRODUCT_NO_IMAGE_ID,
  SEO_INACTIVE_ID,
  SEO_DELETED_ID,
  SEO_SLUG_PRODUCT_ID,
];
const SEO_CATEGORY_ID = "test-seo-category";
const SEO_EMPTY_CATEGORY_ID = "test-seo-category-empty";

async function cleanSeoFixtures() {
  await prisma.product.deleteMany({ where: { id: { in: SEO_PRODUCT_IDS } } });
  await prisma.category.deleteMany({
    where: { id: { in: [SEO_CATEGORY_ID, SEO_EMPTY_CATEGORY_ID] } },
  });
  await prisma.setting.deleteMany({ where: { key: "store.name" } });
}

function ogImageUrls(metadata: Metadata): string[] {
  const images = metadata.openGraph?.images;
  const list = Array.isArray(images) ? images : images ? [images] : [];
  return list.map((image) =>
    typeof image === "string" || image instanceof URL
      ? String(image)
      : String(image.url),
  );
}

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

    describe("khi DB có tên cửa hàng", () => {
      beforeEach(async () => {
        await cleanSeoFixtures();
        await prisma.setting.create({
          data: { key: "store.name", value: DB_STORE_NAME },
        });
      });
      afterEach(cleanSeoFixtures);

      it("title không chứa tên template và không lặp tên cửa hàng", async () => {
        const metadata = await generateMetadata();
        const title = JSON.stringify(metadata.title);

        expect(title).not.toContain("Next.js with Agent");
        expect(title.split(DB_STORE_NAME)).toHaveLength(2);
        expect(metadata.title).toEqual({
          absolute: `Cửa hàng trực tuyến | ${DB_STORE_NAME}`,
        });
      });

      it("layout shop đặt template tiêu đề theo tên cửa hàng trong DB", async () => {
        const metadata = await shopLayoutMetadata();

        expect(metadata.title).toEqual({
          default: DB_STORE_NAME,
          template: `%s | ${DB_STORE_NAME}`,
        });
        expect(metadata.openGraph).toMatchObject({ siteName: DB_STORE_NAME });
      });

      it("trang chính sách dùng tiêu đề trang (template shop thêm tên), canonical và OpenGraph", async () => {
        const cases: Array<[string, () => Promise<Metadata>, string]> = [
          [
            "/shop/delivery-policy",
            deliveryPolicyMetadata,
            "Chính sách giao hàng",
          ],
          [
            "/shop/payment-policy",
            paymentPolicyMetadata,
            "Chính sách thanh toán",
          ],
          [
            "/shop/return-policy",
            returnPolicyMetadata,
            "Chính sách đổi trả & hoàn tiền",
          ],
          [
            "/shop/privacy",
            privacyPolicyMetadata,
            "Chính sách bảo mật thông tin",
          ],
        ];

        for (const [path, load, pageTitle] of cases) {
          const metadata = await load();
          expect(metadata.title).toBe(pageTitle);
          expect(metadata.alternates?.canonical).toBe(path);
          expect(metadata.openGraph).toMatchObject({
            title: `${pageTitle} | ${DB_STORE_NAME}`,
            url: `${siteConfig.url}${path}`,
            siteName: DB_STORE_NAME,
            locale: "vi_VN",
            type: "website",
          });
          expect(ogImageUrls(metadata)).toEqual(["/opengraph-image"]);
        }
      });
    });

    it("trang chính sách ISR 1 giờ để URL tuyệt đối làm mới sau deploy", () => {
      for (const policyModule of [
        deliveryPolicyModule,
        paymentPolicyModule,
        returnPolicyModule,
        privacyPolicyModule,
      ]) {
        expect(policyModule.revalidate).toBe(3600);
      }
    });

    it("OpenGraph của /shop dùng ảnh OG mặc định", async () => {
      const metadata = await generateMetadata();
      expect(ogImageUrls(metadata)).toEqual(["/opengraph-image"]);
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
    it("render theo request để host lúc build không bị đóng băng", () => {
      expect(robotsModule.dynamic).toBe("force-dynamic");
    });

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
    beforeEach(cleanSeoFixtures);
    afterEach(cleanSeoFixtures);

    it("render theo request để host lúc build không bị đóng băng", () => {
      expect(sitemapModule.dynamic).toBe("force-dynamic");
    });

    it("liệt kê trang công khai bằng URL tuyệt đối, không có / và không có lastModified giả", async () => {
      const entries = await sitemap();

      const urls = entries.map((entry) => entry.url);
      expect(urls).not.toContain(`${siteConfig.url}/`);
      expect(urls).not.toContain(siteConfig.url);

      const staticUrls = [
        `${siteConfig.url}/shop`,
        `${siteConfig.url}/shop/delivery-policy`,
        `${siteConfig.url}/shop/payment-policy`,
        `${siteConfig.url}/shop/return-policy`,
        `${siteConfig.url}/shop/privacy`,
      ];
      for (const url of staticUrls) {
        const entry = entries.find((item) => item.url === url);
        expect(entry, url).toBeDefined();
        expect(entry?.lastModified, url).toBeUndefined();
      }

      // Không chứa URL riêng tư
      expect(urls.some((url) => url.includes("/admin"))).toBe(false);
      expect(urls.some((url) => url.includes("/checkout"))).toBe(false);
      expect(urls.some((url) => url.includes("/orders/guest"))).toBe(false);
    });

    it("chứa URL sản phẩm đang bán với lastModified = updatedAt, bỏ sản phẩm ẩn/đã xoá", async () => {
      const updatedAt = new Date("2026-09-20T03:00:00.000Z");
      await prisma.product.create({
        data: {
          id: SEO_PRODUCT_ID,
          name: "Nước mắm SEO",
          price: 45_000,
          updatedAt,
        },
      });
      await prisma.product.create({
        data: { id: SEO_INACTIVE_ID, name: "Hàng ẩn SEO", isActive: false },
      });
      await prisma.product.create({
        data: {
          id: SEO_DELETED_ID,
          name: "Hàng xoá SEO",
          deletedAt: new Date(),
        },
      });

      const entries = await sitemap();
      const productEntry = entries.find(
        (entry) =>
          entry.url === `${siteConfig.url}/shop/products/${SEO_PRODUCT_ID}`,
      );

      expect(productEntry).toBeDefined();
      expect(new Date(String(productEntry?.lastModified)).toISOString()).toBe(
        updatedAt.toISOString(),
      );
      const urls = entries.map((entry) => entry.url);
      expect(urls.some((url) => url.endsWith(SEO_INACTIVE_ID))).toBe(false);
      expect(urls.some((url) => url.endsWith(SEO_DELETED_ID))).toBe(false);
    });
  });

  describe("Sitemap — slug SEO", () => {
    beforeEach(cleanSeoFixtures);
    afterEach(cleanSeoFixtures);

    it("dùng URL slug cho sản phẩm có slug, URL id cho sản phẩm chưa có, và thêm trang danh mục có hàng", async () => {
      await prisma.category.createMany({
        data: [
          { id: SEO_CATEGORY_ID, name: "Nước chấm SEO", slug: "nuoc-cham-seo" },
          { id: SEO_EMPTY_CATEGORY_ID, name: "Trống SEO", slug: "trong-seo" },
        ],
      });
      await prisma.product.create({
        data: {
          id: SEO_SLUG_PRODUCT_ID,
          name: "Nước mắm slug SEO",
          slug: "nuoc-mam-slug-seo",
          categoryId: SEO_CATEGORY_ID,
        },
      });
      await prisma.product.create({
        data: { id: SEO_PRODUCT_ID, name: "Nước mắm SEO" },
      });

      const urls = (await sitemap()).map((entry) => entry.url);

      expect(urls).toContain(`${siteConfig.url}/shop/p/nuoc-mam-slug-seo`);
      expect(urls).not.toContain(
        `${siteConfig.url}/shop/products/${SEO_SLUG_PRODUCT_ID}`,
      );
      expect(urls).toContain(
        `${siteConfig.url}/shop/products/${SEO_PRODUCT_ID}`,
      );
      expect(urls).toContain(`${siteConfig.url}/shop/c/nuoc-cham-seo`);
      expect(urls).not.toContain(`${siteConfig.url}/shop/c/trong-seo`);
    });
  });

  describe("Product page metadata", () => {
    beforeEach(cleanSeoFixtures);
    afterEach(cleanSeoFixtures);

    it("dùng ảnh sản phẩm cho OpenGraph khi có, không thì ảnh OG mặc định", async () => {
      await prisma.product.create({
        data: {
          id: SEO_PRODUCT_ID,
          name: "Nước mắm SEO",
          price: 45_000,
          imageUrl: "/products/nuoc-mam.webp",
        },
      });
      await prisma.product.create({
        data: { id: SEO_PRODUCT_NO_IMAGE_ID, name: "Muối SEO", price: 5_000 },
      });

      const withImage = await productMetadata({
        params: Promise.resolve({ id: SEO_PRODUCT_ID }),
      });
      expect(withImage.title).toBe("Nước mắm SEO");
      expect(withImage.alternates?.canonical).toBe(
        `/shop/products/${SEO_PRODUCT_ID}`,
      );
      expect(ogImageUrls(withImage)).toEqual([
        `${siteConfig.url}/products/nuoc-mam.webp`,
      ]);

      const withoutImage = await productMetadata({
        params: Promise.resolve({ id: SEO_PRODUCT_NO_IMAGE_ID }),
      });
      expect(ogImageUrls(withoutImage)).toEqual(["/opengraph-image"]);
    });

    it("canonical là URL slug cho cả trang slug lẫn URL id cũ", async () => {
      await prisma.product.create({
        data: {
          id: SEO_SLUG_PRODUCT_ID,
          name: "Nước mắm slug SEO",
          slug: "nuoc-mam-slug-seo",
          price: 45_000,
        },
      });

      const bySlug = await productSlugMetadata({
        params: Promise.resolve({ slug: "nuoc-mam-slug-seo" }),
      });
      expect(bySlug.title).toBe("Nước mắm slug SEO");
      expect(bySlug.alternates?.canonical).toBe("/shop/p/nuoc-mam-slug-seo");
      expect(bySlug.openGraph?.url).toBe(
        `${siteConfig.url}/shop/p/nuoc-mam-slug-seo`,
      );

      const byId = await productMetadata({
        params: Promise.resolve({ id: SEO_SLUG_PRODUCT_ID }),
      });
      expect(byId.alternates?.canonical).toBe("/shop/p/nuoc-mam-slug-seo");

      const missing = await productSlugMetadata({
        params: Promise.resolve({ slug: "khong-ton-tai" }),
      });
      expect(missing.title).toBe("Sản phẩm không tồn tại");
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
    it("POS dùng manifest.webmanifest, shop dùng shop.webmanifest", async () => {
      expect(posMetadata.manifest).toBe("/manifest.webmanifest");
      expect((await shopLayoutMetadata()).manifest).toBe("/shop.webmanifest");
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
