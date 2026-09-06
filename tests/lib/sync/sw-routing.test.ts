import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

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
