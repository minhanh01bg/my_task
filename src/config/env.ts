import { z } from "zod";

/**
 * Server-only environment configuration schema.
 *
 * CRITICAL SECURITY INVARIANT:
 * Production startup MUST fail immediately before serving any traffic
 * if mandatory security configurations (Upstash Redis REST URL & token,
 * rate limit HMAC secret, trusted proxy configuration, or canonical origin)
 * are absent or malformed.
 */
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    NEXT_PUBLIC_APP_NAME: z.string().min(1).default("Next.js with Agent"),
    NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
    SENTRY_AUTH_TOKEN: z.string().optional(),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),
    DATABASE_URL: z.string().min(1).default("file:./dev.db"),
    SESSION_SECRET: z
      .string()
      .min(32)
      .default("dev-only-secret-please-change-me!!"),
    STORE_PASSWORD_HASH: z.string().default(""),

    // Distributed rate-limiting via Upstash Redis REST
    UPSTASH_REDIS_REST_URL: z.string().url().optional(),
    UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),

    // Keyed HMAC secret for pseudonymizing client identifiers (IP, phone, session)
    RATE_LIMIT_KEY_SECRET: z.string().min(32).optional(),

    // Trusted proxy resolution mode
    TRUSTED_PROXY_MODE: z
      .enum(["none", "vercel", "cloudflare", "custom"])
      .default("none"),
    TRUSTED_CLIENT_IP_HEADER: z.string().min(1).optional(),

    // Canonical application origin for CSRF and Origin header validation
    CANONICAL_ORIGIN: z.string().url().optional(),

    // Content Security Policy rollout mode
    CSP_MODE: z
      .enum(["report-only", "enforce", "disabled"])
      .default("report-only"),

    // Data retention window in days for customer PII & audit logs
    DATA_RETENTION_DAYS: z.coerce.number().int().positive().default(90),
  })
  .superRefine((data, ctx) => {
    // In production, security controls fail closed: required variables must be strictly enforced.
    if (data.NODE_ENV === "production") {
      if (!data.UPSTASH_REDIS_REST_URL) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "UPSTASH_REDIS_REST_URL is required in production for distributed rate limiting",
          path: ["UPSTASH_REDIS_REST_URL"],
        });
      }
      if (!data.UPSTASH_REDIS_REST_TOKEN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "UPSTASH_REDIS_REST_TOKEN is required in production for distributed rate limiting",
          path: ["UPSTASH_REDIS_REST_TOKEN"],
        });
      }
      if (
        !data.RATE_LIMIT_KEY_SECRET ||
        data.RATE_LIMIT_KEY_SECRET.length < 32
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "RATE_LIMIT_KEY_SECRET must be configured with at least 32 characters in production",
          path: ["RATE_LIMIT_KEY_SECRET"],
        });
      }
      if (data.TRUSTED_PROXY_MODE === "none") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "TRUSTED_PROXY_MODE must be configured in production (cannot be 'none')",
          path: ["TRUSTED_PROXY_MODE"],
        });
      }
      if (
        data.TRUSTED_PROXY_MODE === "custom" &&
        !data.TRUSTED_CLIENT_IP_HEADER
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "TRUSTED_CLIENT_IP_HEADER is required when TRUSTED_PROXY_MODE is 'custom'",
          path: ["TRUSTED_CLIENT_IP_HEADER"],
        });
      }
      if (!data.CANONICAL_ORIGIN) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "CANONICAL_ORIGIN is required in production for origin and CSRF validation",
          path: ["CANONICAL_ORIGIN"],
        });
      }
    }
  });

export function validateEnv(rawEnv: Record<string, unknown> = process.env) {
  return envSchema.safeParse(rawEnv);
}

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "❌ Invalid environment variables",
    parsed.error.flatten().fieldErrors,
  );
  throw new Error("Invalid environment variables");
}

export const env = parsed.data;
