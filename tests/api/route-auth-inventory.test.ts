import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { isPublicPath } from "@/lib/auth/public-paths";

const API_DIR = path.resolve(__dirname, "../../src/app/api");
const HTTP_METHODS = /^(GET|HEAD|POST|PUT|PATCH|DELETE|OPTIONS)\b/;
const ADMIN_GUARD = /\b(hasAdminSession|requireAdminSession)\(/;

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return routeFiles(full);
    return entry === "route.ts" ? [full] : [];
  });
}

/** src/app/api/online/products/[id]/reviews/route.ts -> /api/online/products/x/reviews */
function toPathname(file: string): string {
  const segments = path
    .relative(path.dirname(API_DIR), path.dirname(file))
    .split(path.sep)
    .filter((segment) => !/^\(.*\)$/.test(segment))
    .map((segment) => (/^\[.*\]$/.test(segment) ? "x" : segment));
  return `/${segments.join("/")}`;
}

function isAdminProtected(pathname: string): boolean {
  return !isPublicPath(pathname) && !pathname.startsWith("/api/customer/");
}

// proxy.ts chỉ thấy cookie pos_session TỒN TẠI; route handler mới là ranh giới
// tin cậy nên từng handler của API quản trị phải tự xác minh phiên.
describe("API quản trị tự xác minh phiên", () => {
  const routes = routeFiles(API_DIR).map((file) => ({
    file: path.relative(API_DIR, file),
    pathname: toPathname(file),
    source: readFileSync(file, "utf8"),
  }));
  const protectedRoutes = routes.filter((route) =>
    isAdminProtected(route.pathname),
  );

  it("liệt kê đúng các route POS/quản trị cần bảo vệ", () => {
    expect(protectedRoutes.map((route) => route.pathname)).toEqual(
      expect.arrayContaining([
        "/api/admin/notifications",
        "/api/catalog",
        "/api/customers",
        "/api/orders",
        "/api/products/images",
      ]),
    );
  });

  it("mọi handler HTTP không công khai đều gọi hasAdminSession/requireAdminSession", () => {
    const offenders = protectedRoutes.flatMap((route) =>
      route.source
        .split(/export\s+(?:async\s+)?function\s+/)
        .slice(1)
        .filter((chunk) => HTTP_METHODS.test(chunk) && !ADMIN_GUARD.test(chunk))
        .map((chunk) => `${chunk.match(HTTP_METHODS)![1]} ${route.pathname}`),
    );

    expect(offenders).toEqual([]);
  });
});
