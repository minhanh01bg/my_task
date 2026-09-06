import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/lib/auth/public-paths";
describe("customer route classification", () => {
  it("chỉ public auth và guest capability", () => {
    expect(isPublicPath("/api/customer-auth/login")).toBe(true);
    expect(isPublicPath("/orders/guest/token")).toBe(true);
    expect(isPublicPath("/api/customer/orders")).toBe(false);
    expect(isPublicPath("/admin/orders")).toBe(false);
  });
});
