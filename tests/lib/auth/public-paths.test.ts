import { describe, expect, it } from "vitest";

import { isPublicPath } from "@/lib/auth/public-paths";

describe("isPublicPath", () => {
  it.each([
    "/",
    "/shop",
    "/checkout",
    "/order-success/DH1",
    "/api/online/orders",
    "/api/online/wishlist",
    "/api/online/vouchers/validate",
    "/api/online/products/product-1/reviews",
  ])("mở %s", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });
  it.each([
    "/admin",
    "/pos",
    "/api/orders",
    "/api/online/orders/other",
    "/api/online/wishlist/private",
    "/api/online/vouchers",
    "/api/online/products/p1",
    "/api/online/products/p1/reviews/private",
    "/api/online/products/p1/admin/reviews",
  ])("giữ kín %s", (path) => {
    expect(isPublicPath(path)).toBe(false);
  });
});
