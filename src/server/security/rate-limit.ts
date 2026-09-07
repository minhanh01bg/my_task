import { createHmac } from "node:crypto";
import { Redis } from "@upstash/redis";

import { env } from "@/config/env";
import type { RateLimitPolicy } from "./rate-limit-policy";

export interface RateLimitStore {
  incrementAndGetTtl(
    key: string,
    windowSeconds: number,
    now?: number,
  ): Promise<{ count: number; ttlSeconds: number }>;
}

export class UpstashRedisStore implements RateLimitStore {
  private redis: Redis;
  private static readonly LUA_SCRIPT = `
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
local ttl = redis.call('TTL', KEYS[1])
return { current, ttl }
`;

  constructor(url?: string, token?: string) {
    const redisUrl = url ?? env.UPSTASH_REDIS_REST_URL;
    const redisToken = token ?? env.UPSTASH_REDIS_REST_TOKEN;

    if (!redisUrl || !redisToken) {
      throw new Error("Missing Upstash Redis REST URL or token configuration");
    }

    this.redis = new Redis({
      url: redisUrl,
      token: redisToken,
    });
  }

  async incrementAndGetTtl(
    key: string,
    windowSeconds: number,
  ): Promise<{ count: number; ttlSeconds: number }> {
    const res = (await this.redis.eval(
      UpstashRedisStore.LUA_SCRIPT,
      [key],
      [windowSeconds],
    )) as unknown;

    if (
      !Array.isArray(res) ||
      typeof res[0] !== "number" ||
      typeof res[1] !== "number"
    ) {
      throw new Error("Malformed response from Redis rate limiter");
    }

    const count = res[0];
    const ttlSeconds = res[1] > 0 ? res[1] : windowSeconds;
    return { count, ttlSeconds };
  }
}

export interface RateLimitTarget {
  bucketName: string;
  dimension: string;
  identifier: string;
}

export type RateLimitDecision =
  | {
      allowed: true;
      remaining: number;
      limit: number;
      resetInSeconds: number;
    }
  | {
      allowed: false;
      reason: "rate_limited";
      retryAfterSeconds: number;
      limit: number;
      remaining: 0;
    }
  | {
      allowed: false;
      reason: "limiter_unavailable";
      retryAfterSeconds: number;
      limit: number;
      remaining: 0;
    };

/**
 * Derives an HMAC-SHA256 pseudonymized key for a given rate-limit dimension.
 *
 * CRITICAL SECURITY INVARIANT:
 * Plaintext identifiers (IP addresses, subnets, phone numbers, product IDs, tokens)
 * must NEVER be sent to Redis or stored in cache keys.
 */
export function deriveRateLimitKey(
  version: string,
  bucketName: string,
  dimension: string,
  rawIdentifier: string,
  secret: string = env.RATE_LIMIT_KEY_SECRET ||
    "fallback-secret-at-least-32-chars-long",
): string {
  const hash = createHmac("sha256", secret)
    .update(`${dimension}:${rawIdentifier}`)
    .digest("hex")
    .slice(0, 32);

  return `rl:${version}:${bucketName}:${dimension}:${hash}`;
}

export interface RateLimiterOptions {
  store?: RateLimitStore;
  secret?: string;
  timeoutMs?: number;
}

export interface RateLimiter {
  check(
    policy: RateLimitPolicy,
    targets: RateLimitTarget[],
  ): Promise<RateLimitDecision>;
}

export function createRateLimiter(
  options: RateLimiterOptions = {},
): RateLimiter {
  const secret =
    options.secret ??
    env.RATE_LIMIT_KEY_SECRET ??
    "dev-test-rate-limit-secret-32-characters";

  return {
    async check(
      policy: RateLimitPolicy,
      targets: RateLimitTarget[],
    ): Promise<RateLimitDecision> {
      const timeoutMs = options.timeoutMs ?? policy.timeoutMs ?? 1500;

      // Lazy instantiate production store if not provided
      let store = options.store;
      if (!store) {
        try {
          store = new UpstashRedisStore();
        } catch {
          if (policy.failClosed) {
            return {
              allowed: false,
              reason: "limiter_unavailable",
              retryAfterSeconds: 60,
              limit: 0,
              remaining: 0,
            };
          }
          return {
            allowed: true,
            remaining: 1,
            limit: 1,
            resetInSeconds: 60,
          };
        }
      }

      try {
        const checkWithTimeout = async () => {
          let minRemaining = Infinity;
          let maxRetryAfter = 0;
          let overallLimit = 0;
          let isExceeded = false;
          let maxTtl = 0;

          for (const target of targets) {
            const bucketConfig = policy.buckets.find(
              (b) => b.name === target.bucketName,
            );
            if (!bucketConfig) continue;

            overallLimit = bucketConfig.limit;
            const key = deriveRateLimitKey(
              "v1",
              `${policy.name}:${target.bucketName}`,
              target.dimension,
              target.identifier,
              secret,
            );

            const result = await store.incrementAndGetTtl(
              key,
              bucketConfig.windowSeconds,
            );

            if (
              typeof result?.count !== "number" ||
              typeof result?.ttlSeconds !== "number" ||
              isNaN(result.count) ||
              isNaN(result.ttlSeconds)
            ) {
              throw new Error("Malformed limiter result");
            }

            const remaining = Math.max(0, bucketConfig.limit - result.count);
            if (remaining < minRemaining) {
              minRemaining = remaining;
            }
            if (result.ttlSeconds > maxTtl) {
              maxTtl = result.ttlSeconds;
            }

            if (result.count > bucketConfig.limit) {
              isExceeded = true;
              if (result.ttlSeconds > maxRetryAfter) {
                maxRetryAfter = result.ttlSeconds;
              }
            }
          }

          if (isExceeded) {
            return {
              allowed: false as const,
              reason: "rate_limited" as const,
              retryAfterSeconds: Math.max(1, maxRetryAfter),
              limit: overallLimit,
              remaining: 0 as const,
            };
          }

          return {
            allowed: true as const,
            remaining: minRemaining === Infinity ? 0 : minRemaining,
            limit: overallLimit,
            resetInSeconds: maxTtl,
          };
        };

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error("Rate limiter timeout")),
            timeoutMs,
          ),
        );

        return await Promise.race([checkWithTimeout(), timeoutPromise]);
      } catch {
        if (policy.failClosed) {
          return {
            allowed: false,
            reason: "limiter_unavailable",
            retryAfterSeconds: 60,
            limit: 0,
            remaining: 0,
          };
        }
        return {
          allowed: true,
          remaining: 1,
          limit: 1,
          resetInSeconds: 60,
        };
      }
    },
  };
}
