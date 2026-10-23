import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import * as publicCacheModule from "@/server/cache/public-cache";
import { prisma } from "@/server/db/prisma";
import { getVoucherByCode } from "@/server/vouchers/get-voucher";

// Giả lập unstable_cache: chỉ lưu khi loader trả về, loader ném thì không lưu.
const cache = new Map<string, unknown>();

beforeEach(async () => {
  cache.clear();
  vi.spyOn(publicCacheModule, "cachedPublic").mockImplementation(
    async <T>(fn: () => Promise<T>, keyParts: string[]): Promise<T> => {
      const key = keyParts.join("|");
      if (cache.has(key)) return cache.get(key) as T;
      const value = await fn();
      cache.set(key, value);
      return value;
    },
  );
  await prisma.voucher.deleteMany();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await prisma.voucher.deleteMany();
});

describe("getVoucherByCode — cache", () => {
  it("BL-5: mã không tồn tại không được lưu vào cache", async () => {
    expect(await getVoucherByCode("khongco")).toBeNull();
    expect(await getVoucherByCode("KHONGCO")).toBeNull();
    expect(cache.size).toBe(0);

    await prisma.voucher.create({
      data: { code: "KHONGCO", type: "fixed", value: 10_000 },
    });
    expect(await getVoucherByCode("khongco")).toMatchObject({
      code: "KHONGCO",
      value: 10_000,
    });
  });

  it("mã có thật vẫn được cache", async () => {
    await prisma.voucher.create({
      data: { code: "GIAM10", type: "percent", value: 10 },
    });
    expect(await getVoucherByCode("giam10")).toMatchObject({
      code: "GIAM10",
      value: 10,
    });
    expect(cache.size).toBe(1);

    await prisma.voucher.update({
      where: { code: "GIAM10" },
      data: { value: 20 },
    });
    expect(await getVoucherByCode("GIAM10")).toMatchObject({ value: 10 });
  });
});
