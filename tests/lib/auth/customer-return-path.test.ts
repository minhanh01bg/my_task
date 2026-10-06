import { expect, it } from "vitest";

import { customerReturnPath } from "@/lib/auth/customer-return-path";

it("chỉ cho quay lại đường dẫn đơn của khách", () => {
  expect(customerReturnPath("/orders/guest/token_123-abc")).toBe(
    "/orders/guest/token_123-abc",
  );
  expect(customerReturnPath("/account/orders/order123")).toBe(
    "/account/orders/order123",
  );
  for (const path of [
    undefined,
    "https://example.com",
    "//example.com",
    "/admin",
    "/orders/guest/../admin",
    "/orders/guest/x?next=https://example.com",
  ]) {
    expect(customerReturnPath(path)).toBe("/account/orders");
  }
});
