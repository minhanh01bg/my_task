import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { flushQueue } from "@/lib/sync/flush";
import {
  clearQueue,
  countQueuedOrders,
  enqueueOrder,
  listQueuedOrders,
} from "@/lib/sync/queue";
import type { OrderPayload } from "@/lib/sync/types";

function payload(clientId: string): OrderPayload {
  return {
    clientId,
    channel: "pos",
    lines: [
      {
        productId: "p1",
        name: "Đường trắng",
        unitPrice: 15000,
        originalPrice: 15000,
        quantity: 1,
        discount: 0,
        unit: "kg",
        isService: false,
      },
    ],
    orderDiscount: 0,
    payments: [{ method: "cash", amount: 15000 }],
  };
}

function okFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      order: { code: "DH0001", total: 15000 },
      duplicated: false,
    }),
  });
}

beforeEach(async () => {
  await clearQueue();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("flushQueue", () => {
  it("hang doi rong thi khong goi mang", async () => {
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    const result = await flushQueue();

    expect(result).toEqual({ sent: 0, failed: 0 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("day het don va xoa khoi hang doi", async () => {
    await enqueueOrder(payload("c1"));
    await enqueueOrder(payload("c2"));
    vi.stubGlobal("fetch", okFetch());

    const result = await flushQueue();

    expect(result.sent).toBe(2);
    expect(await countQueuedOrders()).toBe(0);
  });

  it("gui theo dung thu tu ban", async () => {
    await enqueueOrder(payload("c1"));
    await enqueueOrder(payload("c2"));
    const fetchMock = okFetch();
    vi.stubGlobal("fetch", fetchMock);

    await flushQueue();

    const sentIds = fetchMock.mock.calls.map(
      (call) => JSON.parse(call[1].body).clientId,
    );
    expect(sentIds).toEqual(["c1", "c2"]);
  });

  it("van con mat mang thi giu nguyen don trong hang doi", async () => {
    await enqueueOrder(payload("c1"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new TypeError("Failed to fetch")),
    );

    const result = await flushQueue();

    expect(result).toEqual({ sent: 0, failed: 1 });
    expect(await countQueuedOrders()).toBe(1);
  });

  it("ghi lai loi va tang so lan thu khi that bai", async () => {
    await enqueueOrder(payload("c1"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: "Sản phẩm đã xoá" }),
      }),
    );

    await flushQueue();

    const queued = await listQueuedOrders();
    expect(queued[0]?.attempts).toBe(1);
    expect(queued[0]?.lastError).toContain("Sản phẩm đã xoá");
  });

  it("mot don loi khong chan cac don sau", async () => {
    await enqueueOrder(payload("c1"));
    await enqueueOrder(payload("c2"));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          order: { code: "DH0002", total: 15000 },
          duplicated: false,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);

    const result = await flushQueue();

    expect(result).toEqual({ sent: 1, failed: 1 });
    const queued = await listQueuedOrders();
    expect(queued.map((item) => item.clientId)).toEqual(["c1"]);
  });

  it("don server bao trung van duoc xoa khoi hang doi", async () => {
    await enqueueOrder(payload("c1"));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          order: { code: "DH0001", total: 15000 },
          duplicated: true,
        }),
      }),
    );

    const result = await flushQueue();

    expect(result.sent).toBe(1);
    expect(await countQueuedOrders()).toBe(0);
  });
});
