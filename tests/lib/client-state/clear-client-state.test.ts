import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  rememberPendingClaim,
  takePendingClaimPath,
} from "@/features/customer-account/pending-claim";
import {
  clearAdminClientState,
  clearCustomerClientState,
  clearServiceWorkerCaches,
} from "@/lib/client-state/clear-client-state";
import {
  getRecentlyViewed,
  recordRecentlyViewed,
} from "@/lib/storage/recently-viewed";
import { getWishlist, toggleWishlist } from "@/lib/storage/wishlist";
import { loadCatalog, saveCatalog } from "@/lib/sync/catalog-cache";
import { clearQueue, countQueuedOrders, enqueueOrder } from "@/lib/sync/queue";
import { useCartStore } from "@/stores/cart-store";
import { useHeldOrdersStore } from "@/stores/held-orders-store";
import type { CatalogResponse } from "@/types/catalog";

const POS_CART_KEY = "an-phat-pos-current-cart";
const HELD_ORDERS_KEY = "an-phat-pos-held-orders";
const CLEAR_MESSAGE = { type: "pos:clear-caches" };

const catalog: CatalogResponse = {
  categories: [],
  products: [],
  fetchedAt: "2026-10-23T00:00:00.000Z",
};

function stubServiceWorker(value: unknown) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value,
  });
}

/** Worker giả trả lời trên cổng MessageChannel như public/sw.js. */
function answeringWorker() {
  return {
    postMessage: vi.fn((_message: unknown, transfer?: MessagePort[]) => {
      transfer?.[0]?.postMessage({ ok: true });
    }),
  };
}

beforeEach(async () => {
  useCartStore.getState().clear();
  useHeldOrdersStore.setState({ held: [] });
  localStorage.clear();
  sessionStorage.clear();
  await clearQueue();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("clearCustomerClientState (WB-4)", () => {
  it("xoá giỏ hàng, mã giảm giá, yêu thích, đã xem và đơn chờ lưu", () => {
    localStorage.setItem("online-cart-v1", JSON.stringify([{ id: "p1" }]));
    localStorage.setItem("online-voucher-v1", "GIAM10");
    toggleWishlist("p1");
    recordRecentlyViewed({
      id: "p1",
      name: "Lốp",
      price: 1,
      unit: "cái",
      stock: 1,
    });
    rememberPendingClaim("guest-token");

    clearCustomerClientState();

    expect(localStorage.getItem("online-cart-v1")).toBeNull();
    expect(localStorage.getItem("online-voucher-v1")).toBeNull();
    expect(localStorage.getItem("online-wishlist-v1")).toBeNull();
    expect(localStorage.getItem("pos_store_recently_viewed")).toBeNull();
    expect(getWishlist()).toEqual([]);
    expect(getRecentlyViewed()).toEqual([]);
    expect(takePendingClaimPath()).toBeNull();
  });

  it("báo cho giao diện đang mở cập nhật yêu thích và đã xem", () => {
    const events: string[] = [];
    const record = (event: Event) => events.push(event.type);
    window.addEventListener("online-wishlist-updated", record);
    window.addEventListener("recently_viewed_updated", record);

    clearCustomerClientState();

    window.removeEventListener("online-wishlist-updated", record);
    window.removeEventListener("recently_viewed_updated", record);
    expect(events).toEqual(
      expect.arrayContaining([
        "online-wishlist-updated",
        "recently_viewed_updated",
      ]),
    );
  });

  it("không đụng tới dữ liệu của máy bán hàng", () => {
    useCartStore.getState().addService("Vá xe", 30_000);
    localStorage.setItem("admin-sidebar-width", "280");

    clearCustomerClientState();

    expect(localStorage.getItem(POS_CART_KEY)).not.toBeNull();
    expect(localStorage.getItem("admin-sidebar-width")).toBe("280");
  });

  it("không ném lỗi khi trình duyệt chặn storage", () => {
    const originalLocal = Object.getOwnPropertyDescriptor(
      globalThis,
      "localStorage",
    )!;
    const originalSession = Object.getOwnPropertyDescriptor(
      globalThis,
      "sessionStorage",
    )!;
    const blocked = {
      configurable: true,
      get() {
        throw new DOMException("blocked", "SecurityError");
      },
    };
    Object.defineProperty(globalThis, "localStorage", blocked);
    Object.defineProperty(globalThis, "sessionStorage", blocked);
    try {
      expect(() => clearCustomerClientState()).not.toThrow();
    } finally {
      Object.defineProperty(globalThis, "localStorage", originalLocal);
      Object.defineProperty(globalThis, "sessionStorage", originalSession);
    }
  });

  it("vẫn xoá các khoá còn lại khi một lần xoá bị lỗi", () => {
    localStorage.setItem("online-voucher-v1", "GIAM10");
    const removeItem = localStorage.removeItem.bind(localStorage);
    vi.spyOn(localStorage, "removeItem").mockImplementation((key) => {
      if (key === "online-cart-v1")
        throw new DOMException("quota", "QuotaExceededError");
      removeItem(key);
    });

    expect(() => clearCustomerClientState()).not.toThrow();
    expect(localStorage.getItem("online-voucher-v1")).toBeNull();
  });
});

describe("clearAdminClientState (WB-4)", () => {
  it("xoá giỏ đang bán nhưng giữ đơn tạm giữ của cửa hàng", async () => {
    useCartStore.getState().addService("Vá xe", 30_000);
    useHeldOrdersStore.getState().hold(useCartStore.getState().lines, 0);
    const held = localStorage.getItem(HELD_ORDERS_KEY);
    expect(localStorage.getItem(POS_CART_KEY)).not.toBeNull();
    expect(held).not.toBeNull();

    await clearAdminClientState();

    expect(localStorage.getItem(POS_CART_KEY)).toBeNull();
    expect(localStorage.getItem(HELD_ORDERS_KEY)).toBe(held);
  });

  it("xoá danh mục đã lưu nhưng không bao giờ đụng hàng đợi đơn offline", async () => {
    await enqueueOrder({
      clientId: "offline-1",
      channel: "pos",
      lines: [],
      orderDiscount: 0,
      payments: [{ method: "cash", amount: 30_000 }],
    });
    await saveCatalog(catalog);

    await clearAdminClientState();

    expect(await loadCatalog()).toBeNull();
    expect(await countQueuedOrders()).toBe(1);
  });

  it("chờ service worker xác nhận đã xoá cache", async () => {
    const worker = answeringWorker();
    stubServiceWorker({
      controller: null,
      getRegistration: vi.fn(async () => ({ active: worker })),
    });

    await clearAdminClientState();

    expect(worker.postMessage).toHaveBeenCalledWith(CLEAR_MESSAGE, [
      expect.objectContaining({ postMessage: expect.any(Function) }),
    ]);
  });

  it("không ném lỗi khi storage và service worker đều lỗi", async () => {
    vi.spyOn(localStorage, "removeItem").mockImplementation(() => {
      throw new DOMException("blocked", "SecurityError");
    });
    stubServiceWorker({
      controller: null,
      getRegistration: vi.fn(async () => {
        throw new DOMException("blocked", "SecurityError");
      }),
    });

    await expect(clearAdminClientState()).resolves.toBeUndefined();
  });
});

describe("clearServiceWorkerCaches (WEB-7h, WB-4)", () => {
  it("báo worker đang chạy xoá cache và đợi trả lời", async () => {
    let reply: MessagePort | undefined;
    const active = {
      postMessage: vi.fn((_message: unknown, transfer?: MessagePort[]) => {
        reply = transfer?.[0];
      }),
    };
    stubServiceWorker({
      controller: null,
      getRegistration: vi.fn(async () => ({ active })),
    });
    let settled = false;

    const done = clearServiceWorkerCaches().then(() => {
      settled = true;
    });
    await vi.waitFor(() => expect(reply).toBeDefined());
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(settled).toBe(false);

    reply!.postMessage({ ok: true });
    await done;
    const [message, transfer] = active.postMessage.mock.calls[0];
    expect(message).toEqual(CLEAR_MESSAGE);
    expect(transfer?.[0]).toBe(reply);
  });

  it("dùng controller khi không lấy được registration", async () => {
    const controller = answeringWorker();
    stubServiceWorker({
      controller,
      getRegistration: vi.fn(async () => undefined),
    });

    await clearServiceWorkerCaches();

    expect(controller.postMessage).toHaveBeenCalledWith(
      CLEAR_MESSAGE,
      expect.any(Array),
    );
  });

  it("chỉ chờ tối đa 2 giây khi worker không trả lời", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const active = { postMessage: vi.fn() };
    stubServiceWorker({
      controller: null,
      getRegistration: vi.fn(async () => ({ active })),
    });
    let settled = false;

    const done = clearServiceWorkerCaches().then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(1_999);
    expect(active.postMessage).toHaveBeenCalled();
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await done;
    expect(settled).toBe(true);
  });

  it("chỉ chờ tối đa 2 giây khi getRegistration treo", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    stubServiceWorker({
      controller: null,
      getRegistration: vi.fn(() => new Promise(() => {})),
    });

    const done = clearServiceWorkerCaches();
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(done).resolves.toBeUndefined();
  });

  it("gửi rồi đi tiếp khi trình duyệt không có MessageChannel", async () => {
    vi.stubGlobal("MessageChannel", undefined);
    const active = { postMessage: vi.fn() };
    stubServiceWorker({
      controller: null,
      getRegistration: vi.fn(async () => ({ active })),
    });

    await clearServiceWorkerCaches();

    expect(active.postMessage).toHaveBeenCalledWith(CLEAR_MESSAGE);
  });

  it("không lỗi khi trình duyệt không có service worker", async () => {
    await expect(clearServiceWorkerCaches()).resolves.toBeUndefined();
  });

  it("không làm hỏng đăng xuất khi service worker lỗi", async () => {
    stubServiceWorker({
      controller: null,
      getRegistration: vi.fn(async () => {
        throw new DOMException("blocked", "SecurityError");
      }),
    });

    await expect(clearServiceWorkerCaches()).resolves.toBeUndefined();
  });
});
