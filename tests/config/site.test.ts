import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveSiteUrl } from "@/config/site";

describe("resolveSiteUrl", () => {
  it("ưu tiên NEXT_PUBLIC_APP_URL khi được đặt", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_APP_URL: "https://www.shop.example.com",
        CANONICAL_ORIGIN: "https://shop.example.com",
      }),
    ).toBe("https://www.shop.example.com");
  });

  it("dùng CANONICAL_ORIGIN khi không có NEXT_PUBLIC_APP_URL", () => {
    expect(
      resolveSiteUrl({ CANONICAL_ORIGIN: "https://shop.example.com" }),
    ).toBe("https://shop.example.com");
  });

  it("quay về localhost khi cả hai đều thiếu", () => {
    expect(resolveSiteUrl({})).toBe("http://localhost:3000");
  });

  it("bỏ dấu / ở cuối để ghép đường dẫn không bị //", () => {
    expect(
      resolveSiteUrl({ CANONICAL_ORIGIN: "https://shop.example.com/" }),
    ).toBe("https://shop.example.com");
  });
});

describe("siteConfig", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("lấy url từ CANONICAL_ORIGIN khi chỉ biến đó được đặt", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", undefined);
    vi.stubEnv("CANONICAL_ORIGIN", "https://shop.example.com");
    vi.resetModules();

    const { siteConfig } = await import("@/config/site");
    expect(siteConfig.url).toBe("https://shop.example.com");
  });

  it("lấy tên từ NEXT_PUBLIC_STORE_NAME, rồi STORE_NAME, cuối cùng 'Cửa hàng'", async () => {
    vi.stubEnv("NEXT_PUBLIC_STORE_NAME", undefined);
    vi.stubEnv("STORE_NAME", "Tạp hoá Minh An");
    vi.resetModules();
    expect((await import("@/config/site")).siteConfig.name).toBe(
      "Tạp hoá Minh An",
    );

    vi.stubEnv("NEXT_PUBLIC_STORE_NAME", "Cửa hàng An Phát");
    vi.resetModules();
    expect((await import("@/config/site")).siteConfig.name).toBe(
      "Cửa hàng An Phát",
    );

    vi.stubEnv("NEXT_PUBLIC_STORE_NAME", undefined);
    vi.stubEnv("STORE_NAME", undefined);
    vi.resetModules();
    expect((await import("@/config/site")).siteConfig.name).toBe("Cửa hàng");
  });

  it("mô tả tiếng Việt cho cửa hàng tạp hoá", async () => {
    const { siteConfig } = await import("@/config/site");
    expect(siteConfig.description).toBe(
      "Cửa hàng tạp hoá trực tuyến: nhu yếu phẩm, thực phẩm, đồ tiêu dùng chính hãng. Đặt nhanh, giao tận nơi.",
    );
  });
});
