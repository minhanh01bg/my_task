import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { logger } from "@/lib/logger";
import {
  cachedPublic,
  expirePublicNow,
  revalidatePublic,
} from "@/server/cache/public-cache";
import { CACHE_TAGS } from "@/server/cache/tags";

const nextCache = vi.hoisted(() => ({
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn(),
  updateTag: vi.fn(),
}));

vi.mock("next/cache", () => nextCache);

describe("public-cache", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    nextCache.revalidateTag.mockReset();
    nextCache.unstable_cache.mockReset();
    nextCache.updateTag.mockReset();
    warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    warnSpy.mockRestore();
  });

  it("CACHE_TAGS: tên tag cố định và tag theo sản phẩm", () => {
    expect(CACHE_TAGS.catalog).toBe("catalog");
    expect(CACHE_TAGS.settings).toBe("settings");
    expect(CACHE_TAGS.promotions).toBe("promotions");
    expect(CACHE_TAGS.product("p1")).toBe("product:p1");
  });

  describe("revalidatePublic", () => {
    beforeEach(() => {
      // Ngoài Vitest mới thực sự gọi next/cache.
      vi.stubEnv("VITEST", "");
    });

    it("gọi revalidateTag(tag, 'max') cho từng tag", () => {
      revalidatePublic(CACHE_TAGS.catalog, CACHE_TAGS.product("p1"));

      expect(nextCache.revalidateTag).toHaveBeenCalledTimes(2);
      expect(nextCache.revalidateTag).toHaveBeenNthCalledWith(
        1,
        "catalog",
        "max",
      );
      expect(nextCache.revalidateTag).toHaveBeenNthCalledWith(
        2,
        "product:p1",
        "max",
      );
    });

    it("không ném khi revalidateTag lỗi, ghi logger.warn và vẫn xử lý tag còn lại", () => {
      nextCache.revalidateTag.mockImplementationOnce(() => {
        throw new Error("Invariant: static generation store missing");
      });

      expect(() =>
        revalidatePublic(CACHE_TAGS.catalog, CACHE_TAGS.promotions),
      ).not.toThrow();

      expect(nextCache.revalidateTag).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it("bỏ qua next/cache trong Vitest", () => {
      vi.stubEnv("VITEST", "true");

      revalidatePublic(CACHE_TAGS.settings);

      expect(nextCache.revalidateTag).not.toHaveBeenCalled();
    });
  });

  describe("expirePublicNow", () => {
    it("gọi updateTag cho từng tag và không ném khi updateTag lỗi", () => {
      vi.stubEnv("VITEST", "");
      nextCache.updateTag.mockImplementationOnce(() => {
        throw new Error(
          "updateTag can only be called from within a Server Action",
        );
      });

      expect(() => expirePublicNow(CACHE_TAGS.settings, "x")).not.toThrow();

      expect(nextCache.updateTag).toHaveBeenNthCalledWith(1, "settings");
      expect(nextCache.updateTag).toHaveBeenNthCalledWith(2, "x");
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe("cachedPublic", () => {
    it("trong Vitest gọi thẳng fn, không dùng unstable_cache", async () => {
      const fn = vi.fn(async () => 42);

      await expect(
        cachedPublic(fn, ["k"], { tags: ["catalog"], revalidate: 60 }),
      ).resolves.toBe(42);

      expect(fn).toHaveBeenCalledTimes(1);
      expect(nextCache.unstable_cache).not.toHaveBeenCalled();
    });

    it("ngoài Vitest bọc unstable_cache với keyParts, tags, revalidate", async () => {
      vi.stubEnv("VITEST", "");
      nextCache.unstable_cache.mockImplementation(
        (cb: () => Promise<unknown>) => cb,
      );
      const fn = vi.fn(async () => "ok");

      await expect(
        cachedPublic(fn, ["catalog", "v1"], {
          tags: ["catalog"],
          revalidate: 60,
        }),
      ).resolves.toBe("ok");

      expect(nextCache.unstable_cache).toHaveBeenCalledWith(
        expect.any(Function),
        ["catalog", "v1"],
        { tags: ["catalog"], revalidate: 60 },
      );
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it("unstable_cache lỗi vì thiếu store: gọi fn trực tiếp và chỉ warn một lần", async () => {
      vi.stubEnv("VITEST", "");
      nextCache.unstable_cache.mockImplementation(() => async () => {
        throw new Error("Invariant: incrementalCache missing");
      });
      const fn = vi.fn(async () => "fresh");
      const options = { tags: ["catalog"], revalidate: 60 };

      await expect(cachedPublic(fn, ["a"], options)).resolves.toBe("fresh");
      await expect(cachedPublic(fn, ["a"], options)).resolves.toBe("fresh");

      expect(fn).toHaveBeenCalledTimes(2);
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });

    it("lỗi từ chính fn được ném lại, không gọi fn lần hai", async () => {
      vi.stubEnv("VITEST", "");
      nextCache.unstable_cache.mockImplementation(
        (cb: () => Promise<unknown>) => cb,
      );
      const fn = vi.fn(async () => {
        throw new Error("db down");
      });

      await expect(
        cachedPublic(fn, ["b"], { tags: ["catalog"], revalidate: 60 }),
      ).rejects.toThrow("db down");
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });
});
