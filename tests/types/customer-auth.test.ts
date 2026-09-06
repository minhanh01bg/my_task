import { describe, expect, it } from "vitest";
import {
  canonicalizeVietnamesePhone,
  customerLoginSchema,
  customerRegisterSchema,
} from "@/types/customer-auth";

describe("customer auth contract", () => {
  it("canonical số điện thoại Việt Nam", () =>
    expect(canonicalizeVietnamesePhone("0901.234 567")).toBe("+84901234567"));
  it("strict và yêu cầu password đủ dài", () => {
    expect(
      customerLoginSchema.safeParse({ phone: "0901234567", password: "short" })
        .success,
    ).toBe(false);
    expect(
      customerRegisterSchema.safeParse({
        phone: "0901234567",
        password: "a-secure-password",
        displayName: "An",
        role: "admin",
      }).success,
    ).toBe(false);
  });
});
