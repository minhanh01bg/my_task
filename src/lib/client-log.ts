import * as Sentry from "@sentry/nextjs";

/**
 * Bao loi tu code chay tren trinh duyet. `logger` chi danh cho server, nen
 * phia client di qua Sentry giong cac error boundary; Sentry tu tat
 * (`enabled: false`) khi khong cau hinh DSN nen o do day la no-op.
 * `context` la nhan ngan, on dinh — khong nhet du lieu khach hang vao day.
 */
export function reportClientError(error: unknown, context: string): void {
  Sentry.captureException(error, { tags: { context } });
}
