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

it("cho quay lại trang sản phẩm sau khi đăng nhập để nhận báo có hàng", () => {
  expect(customerReturnPath("/shop/p/sua-chua-uong")).toBe(
    "/shop/p/sua-chua-uong",
  );
  expect(customerReturnPath("/shop/products/prod_01")).toBe(
    "/shop/products/prod_01",
  );
  expect(customerReturnPath(`/shop/p/${"a".repeat(80)}`)).toBe(
    `/shop/p/${"a".repeat(80)}`,
  );
});

it("từ chối đường dẫn sản phẩm sai định dạng", () => {
  for (const path of [
    "/shop/p/Sua",
    "/shop/p/a--b",
    "/shop/p/-ab",
    "/shop/p/",
    "/shop/p/x?y=1",
    "/shop/p/x#top",
    "//shop/p/x",
    "/shop/p/x/../admin",
    "/shop/p/x/",
    `/shop/p/${"a".repeat(81)}`,
    "/shop/products/",
    "/shop/products/../admin",
    `/shop/products/${"a".repeat(65)}`,
    "/shop/products/a%2F..%2Fadmin",
  ]) {
    expect(customerReturnPath(path)).toBe("/account/orders");
  }
});
