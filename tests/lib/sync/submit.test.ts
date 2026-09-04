import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearQueue,
  countQueuedOrders,
  listQueuedOrders,
} from "@/lib/sync/queue";
import { submitOrder } from "@/lib/sync/submit";
import type { OrderPayload } from "@/lib/sync/types";

function payload(clientId = "c1"): OrderPayload {
  return {
    clientId,
    channel: "pos",
    lines: [
      {
        productId: "p1",
        name: "Đường trắng",
        unitPrice: 15000,
        originalPrice: 15000,
        quantity: 2,
        discount: 0,
        unit: "kg",
        isService: false,
      },
    ],
    orderDiscount: 0,
    payments: [{ method: "cash", amount: 30000 }],
  };
}

beforeEach(async () => {
  await clearQueue();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("submitOrder", () => {
  it("gui thanh cong thi khong xep hang doi", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          order: { code: "DH0001", total: 30000 },
          duplicated: false,
        }),
      }),
    );

    const result = await submitOrder(payload());

    expect(result.synced).toBe(true);
    expect(result.order?.code).toBe("DH0001");
    expect(await countQueuedOrders()).toBe(0);
  });

  it("mat mang thi xep hang doi va KHONG nem loi", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    const result = await submitOrder(payload());

    expect(result.synced).toBe(false);
    expect(result.order).toBeNull();
    expect(await countQueuedOrders()).toBe(1);
  });

  it("server loi 500 thi cung xep hang doi", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }),
    );

    const result = await submitOrder(payload());

    expect(result.synced).toBe(false);
    expect(await countQueuedOrders()).toBe(1);
  });

  it("server tu choi 400 thi VAN xep hang doi de nguoi dung xu ly tay", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: "Sản phẩm đã xoá" }),
      }),
    );

    const result = await submitOrder(payload());

    expect(result.synced).toBe(false);
    const queued = await listQueuedOrders();
    expect(queued[0]?.lastError).toContain("Sản phẩm đã xoá");
  });

  it("gui dung endpoint va dung payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        order: { code: "DH0001", total: 30000 },
        duplicated: false,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await submitOrder(payload("abc"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("/api/orders");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body).clientId).toBe("abc");
  });

  it("don trung (duplicated) van coi la thanh cong", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          order: { code: "DH0001", total: 30000 },
          duplicated: true,
        }),
      }),
    );

    const result = await submitOrder(payload());

    expect(result.synced).toBe(true);
    expect(await countQueuedOrders()).toBe(0);
  });
});
