import { describe, expect, it } from "vitest";

import { isGalleryEnabled } from "@/app/dev/kit/page";

describe("isGalleryEnabled", () => {
  it("bat o dev va test", () => {
    expect(isGalleryEnabled("development")).toBe(true);
    expect(isGalleryEnabled("test")).toBe(true);
  });

  it("tat o production — trang noi bo khong duoc lo ra ngoai", () => {
    expect(isGalleryEnabled("production")).toBe(false);
  });
});
