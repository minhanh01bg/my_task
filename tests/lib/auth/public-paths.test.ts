import { describe, expect, it } from "vitest";

import { isPublicPath } from "@/lib/auth/public-paths";

describe("isPublicPath", () => {
  it.each([
    "/",
    "/shop",
    "/checkout",
    "/order-success/DH1",
    "/api/online/orders",
  ])("mở %s", (path) => {
    expect(isPublicPath(path)).toBe(true);
  });
  it.each(["/admin", "/pos", "/api/orders", "/api/online/orders/other"])(
    "giữ kín %s",
    (path) => {
      expect(isPublicPath(path)).toBe(false);
    },
  );
});
