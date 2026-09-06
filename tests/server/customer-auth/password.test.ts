import { describe, expect, it } from "vitest";
import {
  hashCustomerPassword,
  verifyCustomerPassword,
} from "@/server/customer-auth/password";
import {
  createOpaqueToken,
  digestOpaqueToken,
  CUSTOMER_SESSION_COOKIE,
} from "@/server/customer-auth/session";
import { SESSION_COOKIE } from "@/server/auth/session";

describe("customer credentials", () => {
  it("hash mật khẩu có salt và version", async () => {
    const a = await hashCustomerPassword("correct horse battery");
    const b = await hashCustomerPassword("correct horse battery");
    expect(a).toMatch(/^scrypt-v1\$/);
    expect(a).not.toBe(b);
    expect(await verifyCustomerPassword("correct horse battery", a)).toBe(true);
    expect(await verifyCustomerPassword("wrong password", a)).toBe(false);
  });
  it("token opaque 256-bit chỉ lưu digest", () => {
    const token = createOpaqueToken();
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
    expect(digestOpaqueToken(token)).toMatch(/^[a-f0-9]{64}$/);
    expect(digestOpaqueToken(token)).not.toContain(token);
  });
  it("cookie customer tách biệt admin", () => {
    expect(CUSTOMER_SESSION_COOKIE).toBe("customer_session");
    expect(SESSION_COOKIE).toBe("pos_session");
    expect(CUSTOMER_SESSION_COOKIE).not.toBe(SESSION_COOKIE);
  });
});
