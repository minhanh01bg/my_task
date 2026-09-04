import {
  listQueuedOrders,
  markQueuedFailure,
  removeQueuedOrder,
} from "./queue";

/**
 * Day toan bo hang doi len server, theo dung thu tu ban.
 *
 * Mot don that bai KHONG chan cac don sau — moi don doc lap, va server
 * chong trung bang clientId nen gui lai bao nhieu lan cung an toan.
 *
 * Don loi nghiep vu (san pham da xoa) duoc GIU LAI kem lastError de chu
 * cua hang xu ly tay — khong bao gio tu y bo don da thu tien khach.
 */
export async function flushQueue(): Promise<{ sent: number; failed: number }> {
  const queued = await listQueuedOrders();

  let sent = 0;
  let failed = 0;

  for (const entry of queued) {
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entry.payload),
      });

      if (response.ok) {
        await removeQueuedOrder(entry.clientId);
        sent += 1;
        continue;
      }

      const body = (await response.json().catch(() => null)) as {
        message?: string;
      } | null;
      await markQueuedFailure(
        entry.clientId,
        body?.message ?? `Lỗi máy chủ (${response.status})`,
      );
      failed += 1;
    } catch (error) {
      await markQueuedFailure(
        entry.clientId,
        error instanceof Error ? error.message : "Mất kết nối",
      );
      failed += 1;
    }
  }

  return { sent, failed };
}
