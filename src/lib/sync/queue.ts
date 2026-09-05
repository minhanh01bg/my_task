import { openDB, type IDBPDatabase } from "idb";

import type { OrderPayload, QueuedOrder } from "./types";

const DB_NAME = "pos-sync";
const DB_VERSION = 1;
const ORDER_STORE = "queued-orders";
const CATALOG_STORE = "catalog";

let dbPromise: Promise<IDBPDatabase> | null = null;

export function getSyncDb(): Promise<IDBPDatabase> {
  dbPromise ??= openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(ORDER_STORE)) {
        const store = db.createObjectStore(ORDER_STORE, {
          keyPath: "clientId",
        });
        store.createIndex("queuedAt", "queuedAt");
      }
      if (!db.objectStoreNames.contains(CATALOG_STORE)) {
        db.createObjectStore(CATALOG_STORE);
      }
    },
  });

  return dbPromise;
}

/**
 * Xep don vao hang doi khi khong gui duoc. Khoa la clientId nen goi lai
 * cung mot don khong tao ban ghi thu hai.
 */
/**
 * Su kien bao hang doi vua doi. Chi bao dong bo lang nghe su kien nay thay
 * vi cho vong hoi 15 giay — thu ngan ban offline xong phai thay ngay la don
 * dang cho, khong phai doi.
 */
export const QUEUE_CHANGED_EVENT = "pos:queue-changed";

export function notifyQueueChanged(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(QUEUE_CHANGED_EVENT));
  }
}

export async function enqueueOrder(payload: OrderPayload): Promise<void> {
  const db = await getSyncDb();
  const existing = await db.get(ORDER_STORE, payload.clientId);
  if (existing) return;

  const entry: QueuedOrder = {
    clientId: payload.clientId,
    payload,
    queuedAt: Date.now(),
    attempts: 0,
    lastError: null,
  };

  await db.put(ORDER_STORE, entry);
  notifyQueueChanged();
}

/** Tra ve theo dung thu tu ban — don cu duoc gui truoc. */
export async function listQueuedOrders(): Promise<QueuedOrder[]> {
  const db = await getSyncDb();
  const all = (await db.getAll(ORDER_STORE)) as QueuedOrder[];
  return all.sort((a, b) => a.queuedAt - b.queuedAt);
}

export async function removeQueuedOrder(clientId: string): Promise<void> {
  const db = await getSyncDb();
  await db.delete(ORDER_STORE, clientId);
  notifyQueueChanged();
}

export async function markQueuedFailure(
  clientId: string,
  error: string,
): Promise<void> {
  const db = await getSyncDb();
  const existing = (await db.get(ORDER_STORE, clientId)) as
    | QueuedOrder
    | undefined;
  if (!existing) return;

  await db.put(ORDER_STORE, {
    ...existing,
    attempts: existing.attempts + 1,
    lastError: error,
  });
}

export async function countQueuedOrders(): Promise<number> {
  const db = await getSyncDb();
  return db.count(ORDER_STORE);
}

/** Chi dung trong test. */
export async function clearQueue(): Promise<void> {
  const db = await getSyncDb();
  await db.clear(ORDER_STORE);
}
