import { afterEach, describe, expect, it, vi } from "vitest";

import { clearServiceWorkerCaches } from "@/components/pos/service-worker-registrar";

function stubServiceWorker(value: unknown) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value,
  });
}

afterEach(() => {
  Reflect.deleteProperty(navigator, "serviceWorker");
});

describe("clearServiceWorkerCaches (WEB-7h)", () => {
  it("báo worker đang chạy xoá cache phản hồi", async () => {
    const active = { postMessage: vi.fn() };
    stubServiceWorker({
      controller: null,
      getRegistration: vi.fn(async () => ({ active })),
    });

    await clearServiceWorkerCaches();

    expect(active.postMessage).toHaveBeenCalledWith({
      type: "pos:clear-caches",
    });
  });

  it("dùng controller khi không lấy được registration", async () => {
    const controller = { postMessage: vi.fn() };
    stubServiceWorker({
      controller,
      getRegistration: vi.fn(async () => undefined),
    });

    await clearServiceWorkerCaches();

    expect(controller.postMessage).toHaveBeenCalledWith({
      type: "pos:clear-caches",
    });
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
