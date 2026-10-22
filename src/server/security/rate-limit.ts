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
  delete?(key: string): Promise<void>;
  /** Refunds one unit; must not recreate an expired key. */
  decrement?(key: string): Promise<void>;
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
  // DECR on a missing key would create it without a TTL, so only touch live keys.
  private static readonly DECREMENT_SCRIPT = `
local current = tonumber(redis.call('GET', KEYS[1]))
if current and current > 0 then
  return redis.call('DECR', KEYS[1])
end
return 0
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

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }

  async decrement(key: string): Promise<void> {
    await this.redis.eval(UpstashRedisStore.DECREMENT_SCRIPT, [key], []);
  }
}

class MemoryRateLimitStore implements RateLimitStore {
  private map = new Map<string, { count: number; expiresAt: number }>();

  async incrementAndGetTtl(
    key: string,
    windowSeconds: number,
    now = Date.now(),
  ): Promise<{ count: number; ttlSeconds: number }> {
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

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }

  async decrement(key: string, now = Date.now()): Promise<void> {
    const entry = this.map.get(key);
    if (entry && entry.expiresAt > now && entry.count > 0) entry.count -= 1;
  }
}

let devMemoryStore: MemoryRateLimitStore | null = null;
function getGlobalDevMemoryStore(): RateLimitStore {
  if (!devMemoryStore) {
    devMemoryStore = new MemoryRateLimitStore();
  }
  return devMemoryStore;
}

// One Upstash client per process: the REST client is stateless and safe to
// share, so building it on every check only adds allocation and setup cost.
// A failed construction is not cached, so the next call retries.
let upstashStore: UpstashRedisStore | null = null;
function getGlobalUpstashStore(): RateLimitStore {
  if (!upstashStore) {
    upstashStore = new UpstashRedisStore();
  }
  return upstashStore;
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error("Rate limiter timeout")),
      timeoutMs,
    );
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
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
  reset?(policy: RateLimitPolicy, target: RateLimitTarget): Promise<void>;
  /**
   * Refunds one unit that `check()` consumed on each target, e.g. so a
   * successful login does not count toward a failure budget. Best-effort:
   * store errors are swallowed.
   */
  release?(policy: RateLimitPolicy, targets: RateLimitTarget[]): Promise<void>;
}

const LIMITER_UNAVAILABLE = {
  allowed: false,
  reason: "limiter_unavailable",
  retryAfterSeconds: 60,
  limit: 0,
  remaining: 0,
} as const satisfies RateLimitDecision;

const LIMITER_BYPASSED = {
  allowed: true,
  remaining: 1,
  limit: 1,
  resetInSeconds: 60,
} as const satisfies RateLimitDecision;

/** The shared process store, or `null` when production Redis is unavailable. */
function resolveDefaultStore(): RateLimitStore | null {
  if (process.env.NODE_ENV !== "production") {
    return getGlobalDevMemoryStore();
  }
  if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  try {
    return getGlobalUpstashStore();
  } catch {
    return null;
  }
}

export function createRateLimiter(
  options: RateLimiterOptions = {},
): RateLimiter {
  const secret =
    options.secret ??
    env.RATE_LIMIT_KEY_SECRET ??
    "dev-test-rate-limit-secret-32-characters";

  const keyFor = (policy: RateLimitPolicy, target: RateLimitTarget) =>
    deriveRateLimitKey(
      "v1",
      `${policy.name}:${target.bucketName}`,
      target.dimension,
      target.identifier,
      secret,
    );

  return {
    async check(
      policy: RateLimitPolicy,
      targets: RateLimitTarget[],
    ): Promise<RateLimitDecision> {
      const timeoutMs = options.timeoutMs ?? policy.timeoutMs ?? 1500;

      const store = options.store ?? resolveDefaultStore();
      if (!store) {
        return policy.failClosed ? LIMITER_UNAVAILABLE : LIMITER_BYPASSED;
      }

      try {
        const checkWithTimeout = async (): Promise<RateLimitDecision> => {
          let minRemaining = Infinity;
          let overallLimit = 0;
          let maxTtl = 0;

          // Targets are listed narrowest first (ip, subnet, global). Stop at
          // the first exceeded bucket so traffic already blocked on a narrow
          // bucket never drains the broader budgets shared with everyone else.
          for (const target of targets) {
            const bucketConfig = policy.buckets.find(
              (b) => b.name === target.bucketName,
            );
            if (!bucketConfig) continue;

            const result = await store.incrementAndGetTtl(
              keyFor(policy, target),
              bucketConfig.windowSeconds,
            );
            overallLimit = bucketConfig.limit;

            if (
              typeof result?.count !== "number" ||
              typeof result?.ttlSeconds !== "number" ||
              isNaN(result.count) ||
              isNaN(result.ttlSeconds)
            ) {
              throw new Error("Malformed limiter result");
            }

            if (result.count > bucketConfig.limit) {
              return {
                allowed: false,
                reason: "rate_limited",
                retryAfterSeconds: Math.max(1, result.ttlSeconds),
                limit: bucketConfig.limit,
                remaining: 0,
              };
            }

            minRemaining = Math.min(
              minRemaining,
              bucketConfig.limit - result.count,
            );
            maxTtl = Math.max(maxTtl, result.ttlSeconds);
          }

          return {
            allowed: true,
            remaining: minRemaining === Infinity ? 0 : minRemaining,
            limit: overallLimit,
            resetInSeconds: maxTtl,
          };
        };

        return await withTimeout(checkWithTimeout(), timeoutMs);
      } catch {
        return policy.failClosed ? LIMITER_UNAVAILABLE : LIMITER_BYPASSED;
      }
    },

    async reset(
      policy: RateLimitPolicy,
      target: RateLimitTarget,
    ): Promise<void> {
      const store = options.store ?? resolveDefaultStore();
      if (typeof store?.delete === "function") {
        await store.delete(keyFor(policy, target));
      }
    },

    async release(
      policy: RateLimitPolicy,
      targets: RateLimitTarget[],
    ): Promise<void> {
      const store = options.store ?? resolveDefaultStore();
      if (typeof store?.decrement !== "function") return;
      const timeoutMs = options.timeoutMs ?? policy.timeoutMs ?? 1500;
      try {
        await withTimeout(
          Promise.all(
            targets.map((target) => store.decrement?.(keyFor(policy, target))),
          ),
          timeoutMs,
        );
      } catch {
        // A lost refund only means the attempt keeps counting, as before.
      }
    },
  };
}
