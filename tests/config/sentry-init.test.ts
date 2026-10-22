import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  sanitizeSentryBreadcrumb,
  sanitizeSentryEvent,
  sanitizeSentryTransaction,
} from "@/lib/log-redaction";

const { init } = vi.hoisted(() => ({ init: vi.fn() }));

vi.mock("@sentry/nextjs", () => ({ init }));

describe.each([
  ["server", () => import("../../sentry.server.config")],
  ["edge", () => import("../../sentry.edge.config")],
  ["client", () => import("../../instrumentation-client")],
])("Sentry %s config (WEB-6)", (_runtime, load) => {
  beforeEach(() => {
    init.mockClear();
  });

  it("scrubs error events, transactions and breadcrumbs", async () => {
    await load();

    expect(init).toHaveBeenCalledWith(
      expect.objectContaining({
        beforeSend: sanitizeSentryEvent,
        beforeSendTransaction: sanitizeSentryTransaction,
        beforeBreadcrumb: sanitizeSentryBreadcrumb,
      }),
    );
  });
});
