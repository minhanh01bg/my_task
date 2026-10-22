import { normalizeSafePath } from "../../lib/log-redaction";

export interface CspOptions {
  isDev?: boolean;
  mode?: "report-only" | "enforce" | "disabled";
  nonce?: string;
  sentryDsn?: string;
  extraImageOrigins?: string[];
  reportUri?: string;
}

export interface CspHeaderResult {
  headerName:
    | "Content-Security-Policy"
    | "Content-Security-Policy-Report-Only"
    | null;
  headerValue: string | null;
}

/**
 * Parses a CSP header string into a structured dictionary of directives and values.
 */
export function parseCspDirectives(
  headerValue: string | null | undefined,
): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  if (!headerValue || typeof headerValue !== "string") {
    return result;
  }

  const parts = headerValue
    .split(";")
    .map((p) => p.trim())
    .filter(Boolean);
  for (const part of parts) {
    const tokens = part.split(/\s+/).filter(Boolean);
    if (tokens.length > 0) {
      const directive = tokens[0];
      const values = tokens.slice(1);
      result[directive] = values;
    }
  }

  return result;
}

/**
 * Builds deterministic, environment-aware Content Security Policy headers.
 */
export function buildCspHeader(options?: CspOptions): CspHeaderResult {
  const mode =
    options?.mode ??
    (process.env.CSP_MODE as "report-only" | "enforce" | "disabled") ??
    "report-only";

  if (mode === "disabled") {
    return {
      headerName: null,
      headerValue: null,
    };
  }

  const headerName =
    mode === "enforce"
      ? "Content-Security-Policy"
      : "Content-Security-Policy-Report-Only";

  const isDev = options?.isDev ?? process.env.NODE_ENV === "development";

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
    "object-src": ["'none'"],
  };

  // 1. Script sources
  const scriptSrc: string[] = ["'self'", "https://va.vercel-scripts.com"];
  if (options?.nonce) {
    scriptSrc.push(`'nonce-${options.nonce}'`);
  }
  if (isDev) {
    // Strictly allowed only in development for Next.js Fast Refresh
    scriptSrc.push("'unsafe-eval'");
    scriptSrc.push("'unsafe-inline'");
  } else if (!options?.nonce) {
    // Next.js App Router streaming hydration requires inline scripts when no nonce is set
    scriptSrc.push("'unsafe-inline'");
  }
  directives["script-src"] = scriptSrc;

  // 2. Style sources
  directives["style-src"] = ["'self'", "'unsafe-inline'"];

  // 3. Image sources (never include broad '*')
  const imgSrc: string[] = ["'self'", "data:", "blob:"];
  if (options?.extraImageOrigins && Array.isArray(options.extraImageOrigins)) {
    for (const origin of options.extraImageOrigins) {
      if (origin && origin !== "*" && origin !== "'*'") {
        imgSrc.push(origin.trim());
      }
    }
  }
  directives["img-src"] = imgSrc;

  // 4. Font sources
  directives["font-src"] = ["'self'", "data:"];

  // 5. Connect sources (telemetry, Vercel insights, allowlisted Sentry origin)
  const connectSrc: string[] = [
    "'self'",
    "https://vitals.vercel-insights.com",
    "https://va.vercel-scripts.com",
  ];

  const dsn = options?.sentryDsn ?? process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (dsn) {
    try {
      const parsedUrl = new URL(dsn);
      connectSrc.push(parsedUrl.origin);
    } catch {
      // Ignore invalid Sentry DSN URLs
    }
  }
  directives["connect-src"] = connectSrc;

  // 6. Safe report-uri endpoint
  const reportUri = options?.reportUri ?? "/api/csp-report";
  if (reportUri) {
    directives["report-uri"] = [reportUri];
  }

  const headerValue = Object.entries(directives)
    .map(([directive, values]) => `${directive} ${values.join(" ")}`)
    .join("; ");

  return {
    headerName,
    headerValue,
  };
}

/**
 * Directives that need neither a nonce nor a hash, so they are safe on
 * static/ISR pages and can be enforced while the full policy is report-only.
 */
const BASELINE_DIRECTIVES =
  "object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'";

/**
 * Builds the CSP headers for next.config.ts. In production the baseline is
 * always enforced, whatever CSP_MODE says; the full policy keeps following
 * CSP_MODE (report-only, enforce or disabled).
 */
export function buildCspHeaders(
  options?: CspOptions,
): { key: string; value: string }[] {
  const full = buildCspHeader(options);
  const headers =
    full.headerName && full.headerValue
      ? [{ key: full.headerName, value: full.headerValue }]
      : [];

  const isDev = options?.isDev ?? process.env.NODE_ENV === "development";
  if (isDev || full.headerName === "Content-Security-Policy") {
    return headers;
  }

  const reportUri = options?.reportUri ?? "/api/csp-report";
  return [
    {
      key: "Content-Security-Policy",
      value: reportUri
        ? `${BASELINE_DIRECTIVES}; report-uri ${reportUri}`
        : BASELINE_DIRECTIVES,
    },
    ...headers,
  ];
}

const CSP_SPECIAL_KEYWORDS = new Set([
  "eval",
  "inline",
  "self",
  "data",
  "blob",
  "wasm-eval",
  "wasm-unsafe-eval",
  "'self'",
  "'unsafe-eval'",
  "'unsafe-inline'",
]);

/**
 * Strips URL search parameters and fragments from a URL string without corrupting
 * CSP keywords (e.g., "eval", "inline") or prepending placeholder domains to relative paths.
 */
function stripQueryAndHash(urlStr: string): string {
  if (typeof urlStr !== "string") return urlStr;
  const trimmed = urlStr.trim();
  if (!trimmed) return trimmed;

  if (CSP_SPECIAL_KEYWORDS.has(trimmed.toLowerCase())) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return `${parsed.origin}${parsed.pathname}`;
    }
    return `${parsed.protocol}${parsed.pathname}`;
  } catch {
    return trimmed.split("?")[0].split("#")[0];
  }
}

const MAX_REPORT_FIELD_LENGTH = 512;
const MAX_REPORTS_PER_REQUEST = 5;

/** Reporting API (application/reports+json) names → report-uri names. */
const REPORTING_API_FIELDS = new Map([
  ["documentURL", "document-uri"],
  ["effectiveDirective", "effective-directive"],
  ["blockedURL", "blocked-uri"],
  ["disposition", "disposition"],
  ["statusCode", "status-code"],
  ["sourceFile", "source-file"],
  ["lineNumber", "line-number"],
  ["columnNumber", "column-number"],
]);

const URI_FIELDS = new Set(["document-uri", "blocked-uri", "source-file"]);
const TEXT_FIELDS = new Set(["violated-directive", "effective-directive"]);
const NUMBER_FIELDS = new Set(["status-code", "line-number", "column-number"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Sanitizes one CSP violation report before logging or storing. Keeps only
 * whitelisted fields, strips query strings and fragments from URIs,
 * normalizes guest capability paths and truncates every string. Accepts the
 * legacy `{ "csp-report": {...} }` body or a Reporting API report body.
 */
export function sanitizeCspReport(rawReport: unknown): Record<string, unknown> {
  if (!isRecord(rawReport)) {
    return {};
  }

  const wrapped = rawReport["csp-report"];
  const body = "csp-report" in rawReport ? wrapped : rawReport;
  if (!isRecord(body)) {
    return {};
  }

  const sanitized: Record<string, unknown> = {};

  for (const [rawKey, value] of Object.entries(body)) {
    const key = REPORTING_API_FIELDS.get(rawKey) ?? rawKey;
    if (URI_FIELDS.has(key) && typeof value === "string") {
      sanitized[key] = normalizeSafePath(stripQueryAndHash(value)).slice(
        0,
        MAX_REPORT_FIELD_LENGTH,
      );
    } else if (TEXT_FIELDS.has(key) && typeof value === "string") {
      sanitized[key] = value.slice(0, MAX_REPORT_FIELD_LENGTH);
    } else if (
      key === "disposition" &&
      (value === "enforce" || value === "report")
    ) {
      sanitized[key] = value;
    } else if (
      NUMBER_FIELDS.has(key) &&
      Number.isSafeInteger(value) &&
      (value as number) >= 0
    ) {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Reads the sanitized violations out of a report body: a legacy report-uri
 * object, or a Reporting API batch (only `csp-violation` entries, capped so
 * one request cannot fan out into many log lines).
 */
export function extractCspReports(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) {
    return raw
      .filter(
        (entry): entry is Record<string, unknown> =>
          isRecord(entry) && entry.type === "csp-violation",
      )
      .slice(0, MAX_REPORTS_PER_REQUEST)
      .map((entry) => sanitizeCspReport(entry.body));
  }
  return isRecord(raw) ? [sanitizeCspReport(raw)] : [];
}
