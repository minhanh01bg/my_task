import { describe, expect, it, vi } from "vitest";

import * as manifestRoute from "@/app/shop.webmanifest/route";

vi.mock("@/server/settings/store-settings", () => ({
  getPublicStoreProfile: vi.fn().mockResolvedValue({ name: "Tạp Hóa Xanh" }),
}));

describe("/shop.webmanifest", () => {
  it("cache 1 giờ (ISR) thay vì file tĩnh", () => {
    expect(manifestRoute.revalidate).toBe(3600);
  });

  it("trả manifest JSON theo tên cửa hàng trong DB", async () => {
    const response = await manifestRoute.GET();

    expect(response.headers.get("content-type")).toBe(
      "application/manifest+json",
    );
    const manifest = await response.json();
    expect(manifest).toMatchObject({
      name: "Tạp Hóa Xanh",
      short_name: "Tạp Hóa Xanh",
      start_url: "/shop",
      scope: "/shop",
      display: "standalone",
      lang: "vi",
    });
    expect(manifest.icons).toEqual([
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ]);
  });
});
