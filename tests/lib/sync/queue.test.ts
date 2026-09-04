import { beforeEach, describe, expect, it } from "vitest";

import {
  clearQueue,
  countQueuedOrders,
  enqueueOrder,
  listQueuedOrders,
  markQueuedFailure,
  removeQueuedOrder,
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

describe("hang doi don", () => {
  it("hang doi rong luc dau", async () => {
    expect(await countQueuedOrders()).toBe(0);
    expect(await listQueuedOrders()).toEqual([]);
  });

  it("them don vao hang doi", async () => {
    await enqueueOrder(payload("c1"));

    const queued = await listQueuedOrders();
    expect(queued).toHaveLength(1);
    expect(queued[0]?.clientId).toBe("c1");
    expect(queued[0]?.attempts).toBe(0);
    expect(queued[0]?.lastError).toBeNull();
  });

  it("giu dung thu tu ban — don cu dung truoc", async () => {
    await enqueueOrder(payload("c1"));
    await enqueueOrder(payload("c2"));
    await enqueueOrder(payload("c3"));

    const queued = await listQueuedOrders();
    expect(queued.map((item) => item.clientId)).toEqual(["c1", "c2", "c3"]);
  });

  it("them lai cung clientId khong tao ban ghi thu hai", async () => {
    await enqueueOrder(payload("c1"));
    await enqueueOrder(payload("c1"));

    expect(await countQueuedOrders()).toBe(1);
  });

  it("xoa don khoi hang doi", async () => {
    await enqueueOrder(payload("c1"));
    await enqueueOrder(payload("c2"));

    await removeQueuedOrder("c1");

    const queued = await listQueuedOrders();
    expect(queued.map((item) => item.clientId)).toEqual(["c2"]);
  });

  it("xoa don khong ton tai khong nem loi", async () => {
    await expect(removeQueuedOrder("khong-co")).resolves.toBeUndefined();
  });

  it("ghi nhan that bai lam tang so lan thu", async () => {
    await enqueueOrder(payload("c1"));

    await markQueuedFailure("c1", "Mất mạng");
    await markQueuedFailure("c1", "Mất mạng");

    const queued = await listQueuedOrders();
    expect(queued[0]?.attempts).toBe(2);
    expect(queued[0]?.lastError).toBe("Mất mạng");
  });

  it("giu nguyen payload de gui lai y het", async () => {
    await enqueueOrder(payload("c1"));

    const queued = await listQueuedOrders();
    expect(queued[0]?.payload.lines[0]?.name).toBe("Đường trắng");
    expect(queued[0]?.payload.payments[0]?.amount).toBe(30000);
  });
});

describe("cache danh muc", () => {
  it("luu roi doc lai duoc", async () => {
    const { saveCatalog, loadCatalog } = await import(
      "@/lib/sync/catalog-cache"
    );

    await saveCatalog({
      categories: [{ id: "c1", name: "Tạp hoá", sortOrder: 1 }],
      products: [],
      fetchedAt: new Date().toISOString(),
    });

    const loaded = await loadCatalog();
    expect(loaded?.categories[0]?.name).toBe("Tạp hoá");
  });

  it("danh muc moi khong bi coi la cu", async () => {
    const { isCatalogStale } = await import("@/lib/sync/catalog-cache");

    expect(
      isCatalogStale({
        categories: [],
        products: [],
        fetchedAt: new Date().toISOString(),
      }),
    ).toBe(false);
  });

  it("danh muc qua 24 gio bi coi la cu", async () => {
    const { isCatalogStale } = await import("@/lib/sync/catalog-cache");

    const yesterday = new Date(
      Date.now() - 25 * 60 * 60 * 1000,
    ).toISOString();
    expect(
      isCatalogStale({ categories: [], products: [], fetchedAt: yesterday }),
    ).toBe(true);
  });
});
