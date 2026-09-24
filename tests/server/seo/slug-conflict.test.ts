import { Prisma } from "@prisma/client";
import { describe, expect, it, vi } from "vitest";

import {
  isSlugConflict,
  retryOnSlugConflict,
} from "@/server/seo/slug-conflict";

function uniqueError(target: unknown) {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint", {
    code: "P2002",
    clientVersion: "test",
    meta: { target },
  });
}

describe("isSlugConflict", () => {
  it("nhận P2002 trên slug (mảng cột hoặc tên index)", () => {
    expect(isSlugConflict(uniqueError(["slug"]))).toBe(true);
    expect(isSlugConflict(uniqueError("Product_slug_key"))).toBe(true);
  });

  it("bỏ qua unique khác và lỗi thường", () => {
    expect(isSlugConflict(uniqueError(["sku"]))).toBe(false);
    expect(isSlugConflict(new Error("boom"))).toBe(false);
  });
});

describe("retryOnSlugConflict", () => {
  it("thử lại khi đụng slug rồi trả kết quả", async () => {
    const write = vi
      .fn()
      .mockRejectedValueOnce(uniqueError(["slug"]))
      .mockResolvedValueOnce({ id: "p1" });
    await expect(retryOnSlugConflict(write)).resolves.toEqual({ id: "p1" });
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("ném ngay lỗi unique SKU, và dừng sau 3 lần đụng slug", async () => {
    const skuError = uniqueError(["sku"]);
    const sku = vi.fn().mockRejectedValue(skuError);
    await expect(retryOnSlugConflict(sku)).rejects.toBe(skuError);
    expect(sku).toHaveBeenCalledTimes(1);

    const always = vi.fn().mockRejectedValue(uniqueError(["slug"]));
    await expect(retryOnSlugConflict(always)).rejects.toThrow();
    expect(always).toHaveBeenCalledTimes(3);
  });
});
