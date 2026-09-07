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
 * Strips URL search parameters and fragments from a URL string.
 */
function stripQueryAndHash(urlStr: string): string {
  if (typeof urlStr !== "string") return urlStr;
  try {
    const parsed = new URL(urlStr, "https://placeholder.internal");
    const clean = `${parsed.protocol === "https:" || parsed.protocol === "http:" ? `${parsed.protocol}//${parsed.host}` : ""}${parsed.pathname}`;
    return clean;
  } catch {
    return urlStr.split("?")[0].split("#")[0];
  }
}

/**
 * Sanitizes incoming CSP violation reports before logging or storing.
 * Removes sensitive tokens, query params, hashes, and normalizes guest capability paths.
 */
export function sanitizeCspReport(rawReport: unknown): Record<string, unknown> {
  if (!rawReport || typeof rawReport !== "object") {
    return {};
  }

  const body =
    "csp-report" in rawReport &&
    typeof (rawReport as Record<string, unknown>)["csp-report"] === "object"
      ? ((rawReport as Record<string, unknown>)["csp-report"] as Record<
          string,
          unknown
        >)
      : (rawReport as Record<string, unknown>);

  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(body)) {
    if (typeof value === "string") {
      if (
        key === "document-uri" ||
        key === "blocked-uri" ||
        key === "source-file" ||
        key === "referrer"
      ) {
        // Strip query string and fragment, then apply sensitive path normalization
        const stripped = stripQueryAndHash(value);
        sanitized[key] = normalizeSafePath(stripped);
      } else {
        sanitized[key] = value;
      }
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
