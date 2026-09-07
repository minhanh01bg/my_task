import * as Sentry from "@sentry/nextjs";

const SENSITIVE_KEYS = new Set([
  "phone",
  "address",
  "password",
  "token",
  "secret",
  "customer_session",
  "pos_session",
]);

function sanitizeBreadcrumb(
  breadcrumb: Sentry.Breadcrumb,
): Sentry.Breadcrumb | null {
  if (breadcrumb.data && typeof breadcrumb.data === "object") {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(breadcrumb.data)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = value;
      }
    }
    breadcrumb.data = sanitized;
  }
  return breadcrumb;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
  replaysSessionSampleRate: 0,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  beforeBreadcrumb: sanitizeBreadcrumb,
  beforeSend(event) {
    if (event.request?.data) {
      delete (event.request as Record<string, unknown>).data;
    }
    return event;
  },
});
