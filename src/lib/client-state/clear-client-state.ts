import { clearRecentlyViewed } from "@/lib/storage/recently-viewed";
import { clearWishlist } from "@/lib/storage/wishlist";
import { getSyncDb } from "@/lib/sync/queue";

/**
 * Xoá dữ liệu phiên trên máy khi đăng xuất, để người dùng sau trên máy dùng
 * chung không thấy giỏ hàng, mã giảm giá hay danh mục của phiên trước.
 *
 * Mọi bước đều "cố gắng hết sức": mỗi lần chạm storage nằm trong try/catch,
 * hàm không bao giờ ném lỗi và không chờ quá CLEAR_TIMEOUT_MS, vì đăng xuất
 * không được kẹt lại chỉ vì trình duyệt chặn storage hay service worker treo.
 */

const CLEAR_TIMEOUT_MS = 2_000;

// Khớp với CLEAR_CACHES_MESSAGE trong public/sw.js.
const CLEAR_SW_CACHES_MESSAGE = "pos:clear-caches";

/** Khoá localStorage của khách mua online (giỏ, mã giảm giá). */
const CUSTOMER_LOCAL_KEYS = [
  "online-cart-v1", // src/features/online-store/cart-context.tsx
  "online-voucher-v1", // src/features/online-store/use-voucher.ts
];

/** Đơn khách chờ lưu sau đăng nhập (src/features/customer-account/pending-claim.ts). */
const CUSTOMER_SESSION_KEYS = ["an-phat-pending-claim"];

/**
 * Giỏ đang bán dở trên máy POS (useCartStore). KHÔNG thêm
 * "an-phat-pos-held-orders": đơn tạm giữ là đơn bán dở của cửa hàng (khách
 * quên ví, đang tính dở cho khách khác), chưa lên server và chỉ nằm trên máy
 * này. Ca sau đăng nhập phải lấy lại được để tính tiền, nên đăng xuất giữ
 * nguyên.
 */
const ADMIN_LOCAL_KEYS = ["an-phat-pos-current-cart"];

// Kho "catalog" trong src/lib/sync/catalog-cache.ts. Kho "queued-orders" cùng
// DB giữ đơn offline chưa gửi và tuyệt đối không được xoá.
const CATALOG_STORE = "catalog";

function removeKeys(getStorage: () => Storage, keys: readonly string[]): void {
  for (const key of keys) {
    try {
      getStorage().removeItem(key);
    } catch {
      // Trình duyệt chặn storage (chế độ riêng tư, iframe): không có gì để xoá.
    }
  }
}

/** Đợi `task` xong hoặc tối đa `ms`; không bao giờ reject. */
function settleWithin(task: Promise<unknown>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    const finish = () => {
      clearTimeout(timer);
      resolve();
    };
    task.then(finish, finish);
  });
}

function openChannel(): MessageChannel | null {
  try {
    return new MessageChannel();
  } catch {
    return null;
  }
}

async function askWorkerToClearCaches(
  channel: MessageChannel | null,
): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.getRegistration();
  const worker = registration?.active ?? navigator.serviceWorker.controller;
  if (!worker) return;

  if (!channel) {
    // Không có MessageChannel thì không nhận được trả lời: gửi rồi đi tiếp.
    worker.postMessage({ type: CLEAR_SW_CACHES_MESSAGE });
    return;
  }
  const acknowledged = new Promise<void>((resolve) => {
    channel.port1.onmessage = () => resolve();
  });
  worker.postMessage({ type: CLEAR_SW_CACHES_MESSAGE }, [channel.port2]);
  await acknowledged;
}

/**
 * Báo service worker xoá cache /pos của phiên cũ và đợi nó trả lời trên
 * MessageChannel (tối đa ~2 giây). Thiếu service worker thì cũng không có
 * cache để xoá.
 */
export async function clearServiceWorkerCaches(): Promise<void> {
  const channel = openChannel();
  await settleWithin(askWorkerToClearCaches(channel), CLEAR_TIMEOUT_MS);
  channel?.port1.close();
}

async function clearCachedCatalog(): Promise<void> {
  const db = await getSyncDb();
  await db.clear(CATALOG_STORE);
}

/** Đăng xuất khách: xoá giỏ, mã giảm giá, yêu thích, đã xem, đơn chờ lưu. */
export function clearCustomerClientState(): void {
  removeKeys(() => localStorage, CUSTOMER_LOCAL_KEYS);
  removeKeys(() => sessionStorage, CUSTOMER_SESSION_KEYS);
  // Hai hàm này tự bắt lỗi storage và báo giao diện đang mở cập nhật.
  clearWishlist();
  clearRecentlyViewed();
}

/**
 * Đăng xuất quản trị: xoá giỏ đang bán, danh mục đã lưu trong IndexedDB và
 * cache của service worker. Giữ đơn tạm giữ và hàng đợi đơn offline.
 */
export async function clearAdminClientState(): Promise<void> {
  removeKeys(() => localStorage, ADMIN_LOCAL_KEYS);
  await Promise.all([
    settleWithin(clearCachedCatalog(), CLEAR_TIMEOUT_MS),
    clearServiceWorkerCaches(),
  ]);
}
