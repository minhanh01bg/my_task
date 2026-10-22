import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

import { proxy } from "@/proxy";
import { createOpaqueToken, SESSION_COOKIE } from "@/server/auth/session";

function request(path: string, token: string): NextRequest {
  return new NextRequest(`https://example.com${path}`, {
    headers: { cookie: `${SESSION_COOKIE}=${token}` },
  });
}

const MALFORMED_TOKENS = [
  "forged",
  "A".repeat(42),
  "A".repeat(44),
  `${"A".repeat(42)}=`,
  `${"A".repeat(42)}%`,
  `${"A".repeat(42)}.`,
];

describe("proxy admin session cookie format", () => {
  it("passes a token shaped like createAdminSession() output to the handler", async () => {
    const res = await proxy(request("/api/orders", createOpaqueToken()));

    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it.each(MALFORMED_TOKENS)("answers 401 on /api for %j", async (token) => {
    const res = await proxy(request("/api/orders", token));

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ message: "Chưa đăng nhập" });
  });

  it("redirects a malformed token on /admin to login", async () => {
    const res = await proxy(request("/admin/orders", "forged"));

    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location") ?? "");
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/admin/orders");
  });
});
