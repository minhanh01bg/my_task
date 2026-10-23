import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

const source = readFileSync(
  path.resolve(__dirname, "../../../public/sw.js"),
  "utf8",
);

/** Nap ham routeFor tu sw.js ma khong can moi truong service worker. */
function loadRouteFor(): (pathname: string) => string {
  const start = source.indexOf("function routeFor");
  if (start === -1) throw new Error("sw.js phai co mot ham routeFor");
  const end = source.indexOf("\n}", start) + 2;
  const factory = new Function(`${source.slice(start, end)}; return routeFor;`);
  return factory() as (pathname: string) => string;
}

describe("routeFor", () => {
  const routeFor = loadRouteFor();

  it("man hinh ban di duong network-first", () => {
    expect(routeFor("/pos")).toBe("shell");
    expect(routeFor("/pos/anything")).toBe("shell");
  });

  it("anh san pham di duong cache-first — anh bat bien nen khong can hoi lai", () => {
    expect(routeFor("/uploads/abc.webp")).toBe("image");
  });

  it("KHONG dung den /api — hang doi IndexedDB lo phan offline", () => {
    expect(routeFor("/api/orders")).toBe("skip");
    expect(routeFor("/api/catalog")).toBe("skip");
  });

  it("KHONG dung den /admin — spec da chot la khong offline", () => {
    expect(routeFor("/admin")).toBe("skip");
    expect(routeFor("/admin/products")).toBe("skip");
  });

  it("moi duong khac deu bo qua", () => {
    expect(routeFor("/login")).toBe("skip");
    expect(routeFor("/")).toBe("skip");
  });
});

describe("vong doi cache giao dien", () => {
  it("dung cache co version de deploy moi khong giu shell cu", () => {
    expect(source).toMatch(/const CACHE_VERSION = "v\d+"/);
    expect(source).toContain("pos-shell-${CACHE_VERSION}");
  });

  it("luon hoi mang bo qua HTTP cache khi lam moi shell", () => {
    expect(source).toContain('cache: "reload"');
    expect(source).toContain('cache: "no-store"');
  });
});

type MessageListener = (event: {
  data: unknown;
  waitUntil: (promise: Promise<unknown>) => void;
  ports?: Array<{ postMessage: (message: unknown) => void }>;
}) => void;

/** Chay ca sw.js voi self/caches/indexedDB gia de bat cac listener. */
function loadWorker() {
  const listeners = new Map<string, MessageListener>();
  const cacheStorage = {
    keys: vi.fn(async () => [
      "pos-shell-v4",
      "pos-images-v4",
      "pos-shell-v3",
      "other-app-cache",
    ]),
    delete: vi.fn(async () => true),
  };
  const indexedDB = { open: vi.fn(), deleteDatabase: vi.fn() };
  const workerSelf = {
    addEventListener: (type: string, listener: MessageListener) =>
      listeners.set(type, listener),
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn() },
  };
  new Function("self", "caches", "indexedDB", source)(
    workerSelf,
    cacheStorage,
    indexedDB,
  );
  return { listeners, cacheStorage, indexedDB };
}

describe("xoa cache khi dang xuat (WEB-7h)", () => {
  it("xoa moi cache shell/anh cua POS nhung khong dung den IndexedDB", async () => {
    const { listeners, cacheStorage, indexedDB } = loadWorker();
    const waitUntil = vi.fn();

    listeners.get("message")!({
      data: { type: "pos:clear-caches" },
      waitUntil,
    });

    expect(waitUntil).toHaveBeenCalledTimes(1);
    await waitUntil.mock.calls[0][0];
    expect(
      cacheStorage.delete.mock.calls.map(([key]: unknown[]) => key),
    ).toEqual(["pos-shell-v4", "pos-images-v4", "pos-shell-v3"]);
    // Hang doi don offline nam trong IndexedDB: dang xuat khong duoc lam mat don.
    expect(indexedDB.open).not.toHaveBeenCalled();
    expect(indexedDB.deleteDatabase).not.toHaveBeenCalled();
  });

  it("chi tra loi tren ports[0] sau khi da xoa xong cache (WB-4)", async () => {
    const { listeners, cacheStorage } = loadWorker();
    const pendingDeletes: Array<(deleted: boolean) => void> = [];
    cacheStorage.delete.mockImplementation(
      () => new Promise<boolean>((resolve) => pendingDeletes.push(resolve)),
    );
    const reply = { postMessage: vi.fn() };
    const waitUntil = vi.fn();

    listeners.get("message")!({
      data: { type: "pos:clear-caches" },
      waitUntil,
      ports: [reply],
    });
    await vi.waitFor(() => expect(pendingDeletes).toHaveLength(3));
    expect(reply.postMessage).not.toHaveBeenCalled();

    for (const resolve of pendingDeletes) resolve(true);
    await waitUntil.mock.calls[0][0];
    expect(reply.postMessage).toHaveBeenCalledWith({ ok: true });
  });

  it("van tra loi khi xoa cache loi de trang dang xuat khong phai doi (WB-4)", async () => {
    const { listeners, cacheStorage } = loadWorker();
    cacheStorage.keys.mockRejectedValue(new Error("quota"));
    const reply = { postMessage: vi.fn() };
    const waitUntil = vi.fn();

    listeners.get("message")!({
      data: { type: "pos:clear-caches" },
      waitUntil,
      ports: [reply],
    });

    await waitUntil.mock.calls[0][0];
    expect(reply.postMessage).toHaveBeenCalledWith({ ok: false });
  });

  it.each([null, "pos:clear-caches", { type: "other" }])(
    "bo qua message khong dung dinh dang: %j",
    (data) => {
      const { listeners, cacheStorage } = loadWorker();
      const waitUntil = vi.fn();

      listeners.get("message")!({ data, waitUntil });

      expect(waitUntil).not.toHaveBeenCalled();
      expect(cacheStorage.keys).not.toHaveBeenCalled();
    },
  );
});
