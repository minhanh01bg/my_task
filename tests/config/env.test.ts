import { describe, expect, it } from "vitest";

describe("env", () => {
  it("expose DATABASE_URL, SESSION_SECRET, STORE_PASSWORD_HASH", async () => {
    process.env.DATABASE_URL = "file:./test.db";
    process.env.SESSION_SECRET = "x".repeat(32);
    process.env.STORE_PASSWORD_HASH = "abc";

    const { env } = await import("@/config/env");

    expect(env.DATABASE_URL).toBe("file:./test.db");
    expect(env.SESSION_SECRET).toHaveLength(32);
    expect(env.STORE_PASSWORD_HASH).toBe("abc");
  });
});
