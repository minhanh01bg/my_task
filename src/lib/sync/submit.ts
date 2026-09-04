import { enqueueOrder, markQueuedFailure } from "./queue";
import type { OrderPayload, SubmitResult } from "./types";

/**
 * Duong DUY NHAT ma UI ban hang gui don.
 *
 * Ham nay khong bao gio nem loi: mang hong, server hong, hay server tu choi
 * deu ket thuc bang "don da nam an toan trong hang doi". UI chi can biet
 * `synced` de hien chi bao, va van cho ban tiep binh thuong.
 *
 * Chong trung don do server lo qua clientId — gui lai cung payload la an toan.
 */
export async function submitOrder(
  payload: OrderPayload,
): Promise<SubmitResult> {
  try {
    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const body = (await response.json()) as {
        order: { code: string; total: number };
      };
      return { synced: true, order: body.order };
    }

    const errorBody = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;
    const message = errorBody?.message ?? `Lỗi máy chủ (${response.status})`;

    await enqueueOrder(payload);
    await markQueuedFailure(payload.clientId, message);

    return { synced: false, order: null };
  } catch (error) {
    await enqueueOrder(payload);
    await markQueuedFailure(
      payload.clientId,
      error instanceof Error ? error.message : "Mất kết nối",
    );

    return { synced: false, order: null };
  }
}
