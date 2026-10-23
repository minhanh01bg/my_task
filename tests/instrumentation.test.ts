// @vitest-environment node
import { randomBytes } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { pbkdf2Sync } = vi.hoisted(() => ({ pbkdf2Sync: vi.fn() }));

vi.mock("node:crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:crypto")>();
  pbkdf2Sync.mockImplementation(actual.pbkdf2Sync);
  return { ...actual, default: { ...actual, pbkdf2Sync }, pbkdf2Sync };
});
vi.mock("../sentry.server.config", () => ({}));
vi.mock("../sentry.edge.config", () => ({}));
vi.mock("@/server/db/prisma", () => ({ prismaReady: Promise.resolve() }));
vi.mock("@/server/orders/expire-stale-online-orders", () => ({
  scheduleStaleOnlineOrderExpiry: vi.fn(),
}));
vi.mock("@/server/reviews/backfill-verified-ratings", () => ({
  scheduleVerifiedRatingBackfill: vi.fn(),
}));

const PUBLISHED_HASH =
  "714989c4f592fda0ff69a63ef217e4b0:98dcc3f54f21aa15273f4836302084e830fa296f505bc7187ca79c022470fc0b";

/** Hash moi (100k vong) cua mot mat khau ngau nhien: chua co trong cache. */
function freshHash() {
  const salt = randomBytes(16);
  const derived = pbkdf2Sync(
    randomBytes(12).toString("hex"),
    salt,
    100_000,
    32,
    "sha256",
  );
  return `pbkdf2-sha256:100000:${salt.toString("hex")}:${derived.toString("hex")}`;
}

const PROD_SERVER_ENV = {
  NODE_ENV: "production",
  NEXT_RUNTIME: "nodejs",
  NEXT_PHASE: undefined,
  npm_lifecycle_event: undefined,
  VITEST: "",
  UPSTASH_REDIS_REST_URL: "https://redis.example.com",
  UPSTASH_REDIS_REST_TOKEN: "secret-token",
  RATE_LIMIT_KEY_SECRET: "k".repeat(32),
  TRUSTED_PROXY_MODE: "vercel",
  CANONICAL_ORIGIN: "https://shop.example.com",
  NEXT_PUBLIC_APP_URL: undefined,
  OWNER_PASSWORD_HASH: undefined,
};

async function loadInstrumentation(vars: Record<string, string | undefined>) {
  vi.resetModules();
  for (const [key, value] of Object.entries({ ...PROD_SERVER_ENV, ...vars })) {
    vi.stubEnv(key, value);
  }
  return import("@/instrumentation");
}

beforeEach(() => {
  pbkdf2Sync.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.doUnmock("@/config/env");
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("instrumentation register()", () => {
  it("refuses to boot production with a weak password hash", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { register } = await loadInstrumentation({
      STORE_PASSWORD_HASH: PUBLISHED_HASH,
    });

    await expect(register()).rejects.toThrow("Invalid environment variables");
  });

  it("pays the password-policy PBKDF2 at boot, not on the first request", async () => {
    const { register } = await loadInstrumentation({
      STORE_PASSWORD_HASH: freshHash(),
    });
    pbkdf2Sync.mockClear();

    await register();
    expect(pbkdf2Sync).toHaveBeenCalled();

    // Route bundle nap ban env.ts rieng: phai dung ket qua da tinh luc boot.
    pbkdf2Sync.mockClear();
    vi.resetModules();
    const { env } = await import("@/config/env");
    expect(env.NODE_ENV).toBe("production");
    expect(pbkdf2Sync).not.toHaveBeenCalled();
  });

  it.each([
    ["next build", { NEXT_PHASE: "phase-production-build" }],
    ["tests", { VITEST: "true" }],
    ["the edge runtime", { NEXT_RUNTIME: "edge" }],
  ])("does not load env during %s", async (_label, vars) => {
    vi.doMock("@/config/env", () => {
      throw new Error("env loaded");
    });
    const { register } = await loadInstrumentation({
      STORE_PASSWORD_HASH: PUBLISHED_HASH,
      ...vars,
    });

    await expect(register()).resolves.toBeUndefined();
  });
});
