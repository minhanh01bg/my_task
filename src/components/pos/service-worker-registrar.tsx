"use client";

import { useEffect } from "react";

// Khớp với CLEAR_CACHES_MESSAGE trong public/sw.js.
const CLEAR_SW_CACHES_MESSAGE = "pos:clear-caches";

/**
 * Sau khi đăng xuất, báo service worker xoá cache /pos của phiên cũ. Không
 * bao giờ ném lỗi: thiếu service worker thì cũng không có cache để xoá.
 */
export async function clearServiceWorkerCaches(): Promise<void> {
  try {
    if (!("serviceWorker" in navigator)) return;
    const registration = await navigator.serviceWorker.getRegistration();
    const worker = registration?.active ?? navigator.serviceWorker.controller;
    worker?.postMessage({ type: CLEAR_SW_CACHES_MESSAGE });
  } catch {
    // Trình duyệt chặn service worker (chế độ riêng tư, iframe): bỏ qua.
  }
}

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let refreshing = false;
    let hadController = Boolean(navigator.serviceWorker.controller);

    const handleControllerChange = () => {
      // Cài lần đầu chỉ nhận quyền điều khiển, không có shell cũ cần thay.
      // Reload lúc này sẽ cắt ngang chuyển tab/nhập liệu sau đăng nhập.
      if (!hadController) {
        hadController = true;
        return;
      }
      // Worker moi da thay worker cu: tai dung mot lan de HTML lay lai CSS chunk
      // cua build hien tai. Co controller moi sau reload nen khong lap vo han.
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange,
    );

    void navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => registration.update());

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange,
      );
    };
  }, []);

  return null;
}
