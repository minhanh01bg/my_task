import { describe, expect, it } from "vitest";

import { envSchema } from "@/config/env";

describe("envSchema", () => {
  const validBase = {
    DATABASE_URL: "file:./test.db",
    SESSION_SECRET: "x".repeat(32),
    STORE_PASSWORD_HASH: "abc",
  };

  const validProd = {
    ...validBase,
    NODE_ENV: "production",
    UPSTASH_REDIS_REST_URL: "https://redis.example.com",
    UPSTASH_REDIS_REST_TOKEN: "secret-token",
    RATE_LIMIT_KEY_SECRET: "k".repeat(32),
    TRUSTED_PROXY_MODE: "vercel",
    CANONICAL_ORIGIN: "https://shop.example.com",
  };

  describe("production validation", () => {
    it("accepts a fully configured production environment", () => {
      const result = envSchema.safeParse(validProd);
      expect(result.success).toBe(true);
    });

    it("rejects absent UPSTASH_REDIS_REST_URL in production", () => {
      const env = { ...validProd };
      delete (env as Record<string, unknown>).UPSTASH_REDIS_REST_URL;
      const result = envSchema.safeParse(env);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            i.path.includes("UPSTASH_REDIS_REST_URL"),
          ),
        ).toBe(true);
      }
    });

    it("rejects malformed UPSTASH_REDIS_REST_URL in production", () => {
      const result = envSchema.safeParse({
        ...validProd,
        UPSTASH_REDIS_REST_URL: "not-a-url",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            i.path.includes("UPSTASH_REDIS_REST_URL"),
          ),
        ).toBe(true);
      }
    });

    it("rejects absent UPSTASH_REDIS_REST_TOKEN in production", () => {
      const env = { ...validProd };
      delete (env as Record<string, unknown>).UPSTASH_REDIS_REST_TOKEN;
      const result = envSchema.safeParse(env);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            i.path.includes("UPSTASH_REDIS_REST_TOKEN"),
          ),
        ).toBe(true);
      }
    });

    it("rejects absent or short RATE_LIMIT_KEY_SECRET in production", () => {
      const resultShort = envSchema.safeParse({
        ...validProd,
        RATE_LIMIT_KEY_SECRET: "too-short",
      });
      expect(resultShort.success).toBe(false);
      if (!resultShort.success) {
        expect(
          resultShort.error.issues.some((i) =>
            i.path.includes("RATE_LIMIT_KEY_SECRET"),
          ),
        ).toBe(true);
      }

      const envAbsent = { ...validProd };
      delete (envAbsent as Record<string, unknown>).RATE_LIMIT_KEY_SECRET;
      const resultAbsent = envSchema.safeParse(envAbsent);
      expect(resultAbsent.success).toBe(false);
      if (!resultAbsent.success) {
        expect(
          resultAbsent.error.issues.some((i) =>
            i.path.includes("RATE_LIMIT_KEY_SECRET"),
          ),
        ).toBe(true);
      }
    });

    it("rejects TRUSTED_PROXY_MODE=none in production", () => {
      const result = envSchema.safeParse({
        ...validProd,
        TRUSTED_PROXY_MODE: "none",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            i.path.includes("TRUSTED_PROXY_MODE"),
          ),
        ).toBe(true);
      }
    });

    it("rejects TRUSTED_PROXY_MODE=custom without TRUSTED_CLIENT_IP_HEADER in production", () => {
      const result = envSchema.safeParse({
        ...validProd,
        TRUSTED_PROXY_MODE: "custom",
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) =>
            i.path.includes("TRUSTED_CLIENT_IP_HEADER"),
          ),
        ).toBe(true);
      }
    });

    it("accepts TRUSTED_PROXY_MODE=custom with TRUSTED_CLIENT_IP_HEADER in production", () => {
      const result = envSchema.safeParse({
        ...validProd,
        TRUSTED_PROXY_MODE: "custom",
        TRUSTED_CLIENT_IP_HEADER: "x-real-ip",
      });
      expect(result.success).toBe(true);
    });

    it("rejects absent or malformed CANONICAL_ORIGIN in production", () => {
      const envAbsent = { ...validProd };
      delete (envAbsent as Record<string, unknown>).CANONICAL_ORIGIN;
      const resultAbsent = envSchema.safeParse(envAbsent);
      expect(resultAbsent.success).toBe(false);
      if (!resultAbsent.success) {
        expect(
          resultAbsent.error.issues.some((i) =>
            i.path.includes("CANONICAL_ORIGIN"),
          ),
        ).toBe(true);
      }

      const resultMalformed = envSchema.safeParse({
        ...validProd,
        CANONICAL_ORIGIN: "invalid-url",
      });
      expect(resultMalformed.success).toBe(false);
    });
  });

  describe("development and test validation", () => {
    it("accepts minimal config in test environment without Redis/proxy values", () => {
      const result = envSchema.safeParse({
        ...validBase,
        NODE_ENV: "test",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.TRUSTED_PROXY_MODE).toBe("none");
        expect(result.data.CSP_MODE).toBe("report-only");
        expect(result.data.DATA_RETENTION_DAYS).toBe(90);
      }
    });

    it("accepts explicit safe test values in test/development", () => {
      const result = envSchema.safeParse({
        ...validBase,
        NODE_ENV: "development",
        UPSTASH_REDIS_REST_URL: "https://test-redis.example.com",
        UPSTASH_REDIS_REST_TOKEN: "test-token",
        RATE_LIMIT_KEY_SECRET: "test-secret-at-least-32-chars-long",
        TRUSTED_PROXY_MODE: "none",
        CANONICAL_ORIGIN: "http://localhost:3000",
        CSP_MODE: "enforce",
        DATA_RETENTION_DAYS: 30,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.CSP_MODE).toBe("enforce");
        expect(result.data.DATA_RETENTION_DAYS).toBe(30);
      }
    });
  });

  describe("runtime env export", () => {
    it("exposes DATABASE_URL, SESSION_SECRET, STORE_PASSWORD_HASH", async () => {
      const { env } = await import("@/config/env");

      expect(env.DATABASE_URL).toBeDefined();
      expect(env.SESSION_SECRET).toBeDefined();
      expect(env.STORE_PASSWORD_HASH).toBeDefined();
    });
  });
});
