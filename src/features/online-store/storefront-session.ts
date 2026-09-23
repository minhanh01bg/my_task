import {
  storefrontSessionSchema,
  type StorefrontSession,
} from "@/types/storefront";

export const STOREFRONT_SESSION_ENDPOINT = "/api/storefront/session";
/** Tương đương `staleTime: 60_000` — nhiều header mount trong 60s dùng chung 1 lần gọi. */
export const STOREFRONT_SESSION_STALE_MS = 60_000;

export const GUEST_STOREFRONT_SESSION: StorefrontSession = Object.freeze({
  isAdmin: false,
  isCustomer: false,
});

let cached: { value: StorefrontSession; fetchedAt: number } | null = null;
let inFlight: Promise<StorefrontSession> | null = null;
let generation = 0;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeStorefrontSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Snapshot ổn định tham chiếu cho `useSyncExternalStore`. */
export function getStorefrontSessionSnapshot(): StorefrontSession {
  return cached?.value ?? GUEST_STOREFRONT_SESSION;
}

async function requestSession(): Promise<StorefrontSession> {
  const response = await fetch(STOREFRONT_SESSION_ENDPOINT, {
    headers: { Accept: "application/json" },
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`storefront session HTTP ${response.status}`);
  }
  const parsed = storefrontSessionSchema.safeParse(await response.json());
  if (!parsed.success) {
    throw new Error("storefront session payload invalid");
  }
  return parsed.data;
}

/**
 * Lấy trạng thái phiên (dedupe in-flight, cache 60s, không retry).
 * Lỗi mạng/HTTP giữ trạng thái khách và không được cache để lần mount sau thử lại.
 */
export function loadStorefrontSession(): Promise<StorefrontSession> {
  if (cached && Date.now() - cached.fetchedAt < STOREFRONT_SESSION_STALE_MS) {
    return Promise.resolve(cached.value);
  }
  if (inFlight) return inFlight;

  const requestGeneration = generation;
  const task = requestSession()
    .then((value) => {
      if (requestGeneration === generation) {
        cached = { value, fetchedAt: Date.now() };
        notify();
      }
      return value;
    })
    .catch(() => GUEST_STOREFRONT_SESSION)
    .finally(() => {
      if (inFlight === task) inFlight = null;
    });
  inFlight = task;
  return task;
}

/** Gọi sau đăng nhập/đăng xuất để header không giữ trạng thái cũ tới 60s. */
export function invalidateStorefrontSession() {
  generation += 1;
  inFlight = null;
  if (cached) {
    cached = null;
    notify();
  }
}
