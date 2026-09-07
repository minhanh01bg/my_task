import { env } from "@/config/env";

export type OriginValidationResult =
  | { ok: true; origin: string }
  | {
      ok: false;
      status: 403;
      reason:
        | "missing_origin"
        | "cross_site_fetch"
        | "malformed_origin"
        | "null_origin"
        | "origin_mismatch";
      message: string;
    };

export interface OriginValidationOptions {
  canonicalOrigin?: string;
  allowedOrigins?: string[];
  isProduction?: boolean;
}

/**
 * Validates request Origin and Sec-Fetch-Site headers for state-changing mutations.
 *
 * CRITICAL SECURITY INVARIANTS:
 * - Requests with Sec-Fetch-Site: cross-site MUST always be rejected.
 * - Missing Origin headers on cookie-authenticated mutations MUST fail closed in production.
 * - Opaque ("null") and malformed origins MUST be rejected.
 * - Origin must match canonical configured origins (scheme, host, port).
 * - Generic 403 responses must never reflect or echo untrusted attacker origins.
 */
export function validateMutationOrigin(
  request: Request,
  options?: OriginValidationOptions,
): OriginValidationResult {
  const isProduction = options?.isProduction ?? env.NODE_ENV === "production";

  // Invariant 1: Block explicit cross-site browser fetches immediately
  const secFetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (secFetchSite === "cross-site") {
    return {
      ok: false,
      status: 403,
      reason: "cross_site_fetch",
      message: "Yêu cầu từ nguồn không tin cậy",
    };
  }

  const originHeader = request.headers.get("origin");

  // Invariant 2: In production, missing Origin fails closed for cookie mutations
  if (!originHeader) {
    if (isProduction) {
      return {
        ok: false,
        status: 403,
        reason: "missing_origin",
        message: "Thiếu thông tin nguồn gốc yêu cầu",
      };
    }
    // In local development / test without an explicit origin header, allow same-process requests
    return { ok: true, origin: new URL(request.url).origin };
  }

  // Invariant 3: Opaque/null origin from sandboxed iframes or data URIs
  if (originHeader === "null") {
    return {
      ok: false,
      status: 403,
      reason: "null_origin",
      message: "Nguồn gốc yêu cầu không hợp lệ",
    };
  }

  // Invariant 4: Parse origin strictly as a URL
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(originHeader);
  } catch {
    return {
      ok: false,
      status: 403,
      reason: "malformed_origin",
      message: "Nguồn gốc yêu cầu không đúng định dạng",
    };
  }

  if (parsedOrigin.origin === "null") {
    return {
      ok: false,
      status: 403,
      reason: "null_origin",
      message: "Nguồn gốc yêu cầu không hợp lệ",
    };
  }

  // Invariant 5: Match against allowlist of trusted origins
  const trustedOrigins = new Set<string>();

  if (options?.canonicalOrigin) {
    try {
      trustedOrigins.add(new URL(options.canonicalOrigin).origin);
    } catch {
      // ignore
    }
  }

  if (options?.allowedOrigins) {
    for (const o of options.allowedOrigins) {
      try {
        trustedOrigins.add(new URL(o).origin);
      } catch {
        // ignore
      }
    }
  }

  if (env.CANONICAL_ORIGIN) {
    try {
      trustedOrigins.add(new URL(env.CANONICAL_ORIGIN).origin);
    } catch {
      // ignore
    }
  }

  if (env.NEXT_PUBLIC_APP_URL) {
    try {
      trustedOrigins.add(new URL(env.NEXT_PUBLIC_APP_URL).origin);
    } catch {
      // ignore
    }
  }

  if (!isProduction) {
    try {
      trustedOrigins.add(new URL(request.url).origin);
    } catch {
      // ignore
    }
  }

  if (!trustedOrigins.has(parsedOrigin.origin)) {
    return {
      ok: false,
      status: 403,
      reason: "origin_mismatch",
      message: "Nguồn gốc yêu cầu không được phép",
    };
  }

  return { ok: true, origin: parsedOrigin.origin };
}

/**
 * Boolean convenience helper for route handlers and guards.
 */
export function hasSafeMutationOrigin(
  request: Request,
  options?: OriginValidationOptions,
): boolean {
  return validateMutationOrigin(request, options).ok;
}
