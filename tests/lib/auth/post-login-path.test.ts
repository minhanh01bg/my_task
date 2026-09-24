import { describe, expect, it } from "vitest";

import { resolvePostLoginPath } from "@/lib/auth/post-login-path";

describe("resolvePostLoginPath", () => {
  it("mac dinh ve /pos — thu ngan dang nhap o cung trang", () => {
    expect(resolvePostLoginPath(undefined)).toBe("/pos");
    expect(resolvePostLoginPath("")).toBe("/pos");
  });

  it("quay lai trang admin da yeu cau", () => {
    expect(resolvePostLoginPath("/admin")).toBe("/admin");
    expect(resolvePostLoginPath("/admin/orders?channel=online")).toBe(
      "/admin/orders?channel=online",
    );
    expect(resolvePostLoginPath("/admin?tab=1")).toBe("/admin?tab=1");
    expect(resolvePostLoginPath("/admin/orders#top")).toBe("/admin/orders#top");
    // Doan "." vo hai duoc chuan hoa ve dang trinh duyet se dieu huong.
    expect(resolvePostLoginPath("/admin/./orders")).toBe("/admin/orders");
  });

  it("tu choi moi dich khac de khong thanh open redirect", () => {
    for (const value of [
      "https://evil.example/admin",
      "//evil.example/admin",
      "/\\evil.example",
      "/admin\\..\\evil",
      "/administrator",
      "/pos/../admin",
      "/shop",
      "admin",
      " /admin",
      "/admin/../x",
      "/admin/%2e%2e/pos",
      "/admin/.%2e/x",
      "/admin/\t.\t./x",
    ]) {
      expect(resolvePostLoginPath(value)).toBe("/pos");
    }
  });
});
