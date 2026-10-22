import type { Breadcrumb, ErrorEvent, Event } from "@sentry/nextjs";

const SENSITIVE_KEY_REGEX =
  /(?:password|passwd|token|secret|authorization|cookie|session|phone|address|nonce|recovery|hmackey|keysecret|creditcard|cvv|e-?mail|api[-_]?key)/i;

/**
 * Short words matched as whole words of a camelCase/snake_case key, so
 * "otpCode" and "SENTRY_DSN" match but "footprint" does not.
 */
const SENSITIVE_KEY_WORDS = new Set(["otp", "dsn", "note", "notes"]);

/**
 * Person names are matched on the whole key so "errorName" or "productName"
 * stay readable in logs.
 */
const PERSON_NAME_KEYS = new Set([
  "name",
  "fullname",
  "firstname",
  "lastname",
  "username",
  "displayname",
  "customername",
  "contactname",
  "recipientname",
  "receivername",
]);

/** Request headers kept on Sentry events; everything else is dropped. */
const SAFE_REQUEST_HEADERS = new Set([
  "accept",
  "accept-language",
  "content-length",
  "content-type",
  "host",
  "user-agent",
]);

/** Span attributes that carry only the query string or fragment. */
const SPAN_QUERY_ATTRIBUTES = new Set([
  "http.query",
  "http.fragment",
  "url.query",
  "url.fragment",
]);

/** Span attributes holding a URL or request target. */
const SPAN_URL_ATTRIBUTES = new Set([
  "url",
  "url.full",
  "http.url",
  "http.target",
]);

const SENSITIVE_PATH_PATTERNS = [
  {
    pattern: /\/orders\/guest\/[^\s?#]+(?:\?[^\s#]*)?/g,
    replacement: "/orders/guest/[REDACTED]",
  },
  {
    pattern: /\/order-success\/[^\s?#]+(?:\?[^\s#]*)?/g,
    replacement: "/order-success/[REDACTED]",
  },
  { pattern: /Bearer\s+[A-Za-z0-9._-]+/gi, replacement: "Bearer [REDACTED]" },
];

/**
 * Normalizes sensitive guest capability and receipt paths in URLs and strings.
 */
export function normalizeSafePath(input: string): string {
  if (typeof input !== "string") return input;
  let result = input;
  for (const { pattern, replacement } of SENSITIVE_PATH_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  // Strip sensitive query parameter values
  result = result.replace(
    /([?&](?:token|secret|recovery|key|code)=)[^&]+/gi,
    "$1[REDACTED]",
  );
  return result;
}

export function isSensitiveKey(key: string): boolean {
  if (SENSITIVE_KEY_REGEX.test(key)) return true;
  if (PERSON_NAME_KEYS.has(key.toLowerCase().replace(/[-_\s]/g, ""))) {
    return true;
  }
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .some((word) => SENSITIVE_KEY_WORDS.has(word));
}

function stripQueryAndHash(url: string): string {
  return url.replace(/[?#][\s\S]*$/, "");
}

/**
 * Recursively redacts sensitive keys, tokens, PII, and paths from log payloads.
 * Protects against circular structures and hostile throwing getters.
 */
export function redactLogData(
  data: unknown,
  depth = 0,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (depth > 8) return "[MAX_DEPTH]";
  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    return normalizeSafePath(data);
  }

  if (typeof data !== "object") {
    return data;
  }

  if (seen.has(data)) {
    return "[CIRCULAR]";
  }
  seen.add(data);

  if (Array.isArray(data)) {
    return data.map((item) => redactLogData(item, depth + 1, seen));
  }

  if (data instanceof Error) {
    const errorObj: Record<string, unknown> = {
      name: data.name,
      message: normalizeSafePath(data.message),
    };
    if (data.stack) {
      errorObj.stack = normalizeSafePath(data.stack);
    }
    // Redact any custom properties attached to the Error
    for (const key of Object.getOwnPropertyNames(data)) {
      if (key === "name" || key === "message" || key === "stack") continue;
      if (isSensitiveKey(key)) {
        errorObj[key] = "[REDACTED]";
      } else {
        try {
          const val = (data as unknown as Record<string, unknown>)[key];
          errorObj[key] = redactLogData(val, depth + 1, seen);
        } catch {
          errorObj[key] = "[UNREADABLE]";
        }
      }
    }
    return errorObj;
  }

  const result: Record<string, unknown> = {};
  const descriptors = Object.getOwnPropertyDescriptors(data);

  for (const [key, descriptor] of Object.entries(descriptors)) {
    // Safely evaluate getter if present
    let val: unknown;
    try {
      if (descriptor.get) {
        val = descriptor.get.call(data);
      } else {
        val = descriptor.value;
      }
    } catch {
      result[key] = "[UNREADABLE]";
      continue;
    }

    // Whole value: an object or array under a sensitive key is PII as well.
    if (isSensitiveKey(key)) {
      result[key] = "[REDACTED]";
      continue;
    }

    result[key] = redactLogData(val, depth + 1, seen);
  }

  return result;
}

/**
 * Sanitizes Sentry breadcrumbs before they are added to telemetry.
 */
export function sanitizeSentryBreadcrumb(
  breadcrumb: Breadcrumb,
): Breadcrumb | null {
  if (breadcrumb.data && typeof breadcrumb.data === "object") {
    breadcrumb.data = redactLogData(breadcrumb.data) as Record<string, unknown>;
  }
  if (breadcrumb.message) {
    breadcrumb.message = normalizeSafePath(breadcrumb.message);
  }
  return breadcrumb;
}

/**
 * Central Sentry event scrubber for beforeSend.
 * Strips request bodies, query strings, cookies and non-allowlisted headers,
 * normalizes URLs, and cleans user and extra fields.
 */
export function sanitizeSentryEvent(event: ErrorEvent): ErrorEvent | null {
  return sanitizeEventCommon(event);
}

/**
 * Sentry transaction scrubber for beforeSendTransaction. Applies the same
 * request/user cleanup as error events, then cleans the transaction name and
 * the URL/query attributes of every span.
 */
export function sanitizeSentryTransaction<T extends Event>(event: T): T | null {
  sanitizeEventCommon(event);

  if (event.transaction) {
    event.transaction = normalizeSafePath(stripQueryAndHash(event.transaction));
  }

  const trace = event.contexts?.trace;
  if (trace?.data) {
    trace.data = sanitizeSpanData(trace.data);
  }

  for (const span of event.spans ?? []) {
    // No query stripping here: SQL descriptions use "?" placeholders.
    if (span.description) {
      span.description = normalizeSafePath(span.description);
    }
    span.data = sanitizeSpanData(span.data);
  }

  return event;
}

function sanitizeSpanData<T extends Record<string, unknown>>(data: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SPAN_QUERY_ATTRIBUTES.has(key)) continue;

    const header = /^http\.(?:request|response)\.header\.(.+)$/.exec(key)?.[1];
    if (header && !SAFE_REQUEST_HEADERS.has(header.replaceAll("_", "-"))) {
      continue;
    }

    result[key] =
      SPAN_URL_ATTRIBUTES.has(key) && typeof value === "string"
        ? normalizeSafePath(stripQueryAndHash(value))
        : value;
  }
  return result as T;
}

function sanitizeEventCommon<T extends Event>(event: T): T {
  const request = event.request;
  if (request) {
    // 1. Body, query string and cookies never leave the process
    delete request.data;
    delete request.query_string;
    delete request.cookies;

    // 2. Keep only allowlisted headers (drops cookie, authorization,
    //    x-forwarded-for, referer...)
    if (request.headers) {
      request.headers = Object.fromEntries(
        Object.entries(request.headers).filter(([name]) =>
          SAFE_REQUEST_HEADERS.has(name.toLowerCase()),
        ),
      );
    }

    // 3. Normalize URL without its query string
    if (request.url) {
      request.url = normalizeSafePath(stripQueryAndHash(request.url));
    }
  }

  // 4. Sanitize user identifiers and PII
  if (event.user) {
    if (event.user.ip_address) event.user.ip_address = "[REDACTED]";
    if (event.user.email) event.user.email = "[REDACTED]";
    if (event.user.username) event.user.username = "[REDACTED]";
  }

  // 5. Sanitize breadcrumbs
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(
      (b) => sanitizeSentryBreadcrumb(b)!,
    );
  }

  // 6. Sanitize extra payload
  if (event.extra && typeof event.extra === "object") {
    event.extra = redactLogData(event.extra) as Record<string, unknown>;
  }

  return event;
}
