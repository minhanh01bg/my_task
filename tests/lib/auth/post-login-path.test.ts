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
    ]) {
      expect(resolvePostLoginPath(value)).toBe("/pos");
    }
  });
});
