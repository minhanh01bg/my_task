import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { env } from "@/config/env";
import { POST } from "@/app/api/auth/login/route";
import { setAdminLoginLimiter } from "@/server/auth/rate-limit";
import {
  adminCookieOptions,
  createAdminSession,
  hashPassword,
  SESSION_COOKIE,
} from "@/server/auth/session";
import {
  createRateLimiter,
  type RateLimitStore,
} from "@/server/security/rate-limit";

class MockStore implements RateLimitStore {
  public map = new Map<string, { count: number; expiresAt: number }>();
  public shouldFail = false;

  async incrementAndGetTtl(
    key: string,
    windowSeconds: number,
    now = Date.now(),
  ): Promise<{ count: number; ttlSeconds: number }> {
    if (this.shouldFail) {
      throw new Error("Redis failure");
    }
    const entry = this.map.get(key);
    if (!entry || entry.expiresAt <= now) {
      const expiresAt = now + windowSeconds * 1000;
      this.map.set(key, { count: 1, expiresAt });
      return { count: 1, ttlSeconds: windowSeconds };
    }
    entry.count += 1;
    const ttlSeconds = Math.max(1, Math.ceil((entry.expiresAt - now) / 1000));
    return { count: entry.count, ttlSeconds };
  }

  async decrement(key: string): Promise<void> {
    const entry = this.map.get(key);
    if (entry && entry.count > 0) entry.count -= 1;
  }
}

let store: MockStore;
let originalPasswordHash: string;
let originalCanonicalOrigin: string | undefined;
let originalSecure: boolean;

beforeEach(async () => {
  store = new MockStore();
  const limiter = createRateLimiter({ store, secret: "s".repeat(32) });
  setAdminLoginLimiter(limiter);
  originalPasswordHash = env.STORE_PASSWORD_HASH;
  originalCanonicalOrigin = env.CANONICAL_ORIGIN;
  originalSecure = adminCookieOptions.secure;
  (env as Record<string, unknown>).STORE_PASSWORD_HASH =
    await hashPassword("matkhau-cua-hang");
});

afterEach(() => {
  setAdminLoginLimiter(null);
  (env as Record<string, unknown>).STORE_PASSWORD_HASH = originalPasswordHash;
  (env as Record<string, unknown>).CANONICAL_ORIGIN = originalCanonicalOrigin;
  adminCookieOptions.secure = originalSecure;
});

function makeRequest(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request("https://example.com/api/auth/login", {
    method: "POST",
    headers: new Headers({
      "content-type": "application/json",
      "cf-connecting-ip": "198.51.100.90",
      ...headers,
    }),
    body: JSON.stringify(body),
  });
}

describe("POST /api/auth/login", () => {
  it("sets a usable session cookie for an explicitly configured HTTP store", async () => {
    adminCookieOptions.secure = true;
    (env as Record<string, unknown>).CANONICAL_ORIGIN =
      "http://store.example.com:3000";
    const res = await POST(
      new Request("http://store.example.com:3000/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://store.example.com:3000",
        },
        body: JSON.stringify({ password: "matkhau-cua-hang" }),
      }),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain(SESSION_COOKIE);
    expect(res.headers.get("set-cookie")).toContain("HttpOnly");
    expect(res.headers.get("set-cookie")).not.toContain("Secure");
  });

  it("keeps cookies secure for HTTPS behind a proxy even with an HTTP canonical origin", async () => {
    adminCookieOptions.secure = true;
    (env as Record<string, unknown>).CANONICAL_ORIGIN = "http://example.com";
    const res = await POST(
      new Request("http://example.com/api/auth/login", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "http://example.com",
          "x-forwarded-proto": "https",
        },
        body: JSON.stringify({ password: "matkhau-cua-hang" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("Secure");
  });

  it("does not relax production cookies for an HTTP origin that is not configured", async () => {
    adminCookieOptions.secure = true;
    (env as Record<string, unknown>).CANONICAL_ORIGIN = "https://example.com";
    const res = await POST(
      new Request("http://example.com/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: "matkhau-cua-hang" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("Secure");
  });

  it("rejects cross-site login attempts before reading credentials", async () => {
    const req = makeRequest(
      { password: "matkhau-cua-hang" },
      { origin: "https://attacker.example", "sec-fetch-site": "cross-site" },
    );
    const res = await POST(req);

    expect(res.status).toBe(403);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });

  it("rejects oversized request bodies with 413 before verification", async () => {
    const req = makeRequest({ password: "a".repeat(70_000) });
    const res = await POST(req);
    expect(res.status).toBe(413);
  });

  it("returns 401 with generic error on invalid password", async () => {
    const req = makeRequest({ password: "wrong-password" });
    const res = await POST(req);

    expect(res.status).toBe(401);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const json = await res.json();
    expect(json.message).toBe("Mật khẩu không đúng");
  });

  it("enforces rate limits and returns 429 with Retry-After when IP bucket exhausted", async () => {
    // 10 failed attempts
    for (let i = 0; i < 10; i++) {
      const req = makeRequest({ password: "wrong-password" });
      await POST(req);
    }

    // 11th attempt must be rejected by rate limiter
    const req11 = makeRequest({ password: "wrong-password" });
    const res11 = await POST(req11);

    expect(res11.status).toBe(429);
    expect(res11.headers.get("retry-after")).toBeDefined();
    const json = await res11.json();
    expect(json.message).toBe("Vui lòng thử lại sau");
  });

  describe("shared subnet/global budgets", () => {
    let originalProxyMode: unknown;

    beforeEach(() => {
      originalProxyMode = env.TRUSTED_PROXY_MODE;
      (env as Record<string, unknown>).TRUSTED_PROXY_MODE = "cloudflare";
    });

    afterEach(() => {
      (env as Record<string, unknown>).TRUSTED_PROXY_MODE = originalProxyMode;
    });

    const attempt = (password: string, ip: string) =>
      POST(makeRequest({ password }, { "cf-connecting-ip": ip }));

    it("lets the owner log in from another IP after one IP floods wrong passwords", async () => {
      for (let i = 0; i < 40; i++) {
        await attempt("wrong-password", "198.51.100.10");
      }

      const res = await attempt("matkhau-cua-hang", "203.0.113.20");
      expect(res.status).toBe(200);
    });

    it("still blocks a brute force spread across many IPs", async () => {
      for (let i = 1; i <= 30; i++) {
        const res = await attempt("wrong-password", `198.51.${i}.7`);
        expect(res.status).toBe(401);
      }

      const res = await attempt("wrong-password", "203.0.113.20");
      expect(res.status).toBe(429);
    });

    it("does not count successful logins toward the shared failure budget", async () => {
      for (let i = 1; i <= 29; i++) {
        expect((await attempt("wrong-password", `198.51.${i}.7`)).status).toBe(
          401,
        );
      }
      for (let i = 1; i <= 5; i++) {
        expect((await attempt("matkhau-cua-hang", `192.0.2.${i}`)).status).toBe(
          200,
        );
      }

      const res = await attempt("wrong-password", "203.0.113.20");
      expect(res.status).toBe(401);
    });
  });

  it("fails closed with 503 when distributed limiter is unavailable", async () => {
    store.shouldFail = true;
    const req = makeRequest({ password: "store-password" });
    const res = await POST(req);

    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.message).toBe("Dịch vụ tạm thời không khả dụng");
  });

  it("fails closed with 503 when STORE_PASSWORD_HASH is not configured", async () => {
    const { env } = await import("@/config/env");
    const originalHash = env.STORE_PASSWORD_HASH;
    try {
      (env as Record<string, unknown>).STORE_PASSWORD_HASH = "";
      const req = makeRequest({ password: "some-password" });
      const res = await POST(req);
      expect(res.status).toBe(503);
      expect(res.headers.get("cache-control")).toContain("no-store");
      const json = await res.json();
      expect(json.message).toBe("Chưa cấu hình mật khẩu cửa hàng");
    } finally {
      (env as Record<string, unknown>).STORE_PASSWORD_HASH = originalHash;
    }
  });

  it("rotates and sets new session cookie on successful login", async () => {
    const { token: oldSession } = await createAdminSession();
    const req = makeRequest(
      { password: "matkhau-cua-hang" },
      { cookie: `${SESSION_COOKIE}=${oldSession}` },
    );
    const res = await POST(req);

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
    const cookieHeader = res.headers.get("set-cookie");
    expect(cookieHeader).toBeDefined();
    expect(cookieHeader).toContain(SESSION_COOKIE);
    expect(cookieHeader).toContain("Secure");
    expect(cookieHeader).not.toContain(oldSession);
  });
});
