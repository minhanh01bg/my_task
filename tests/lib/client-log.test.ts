import * as Sentry from "@sentry/nextjs";
import { describe, expect, it, vi } from "vitest";

import { reportClientError } from "@/lib/client-log";

vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }));

describe("reportClientError", () => {
  it("chuyen loi sang Sentry kem ngu canh (Sentry tu tat khi khong co DSN)", () => {
    const error = new Error("boom");
    reportClientError(error, "pos.catalog.save");
    expect(Sentry.captureException).toHaveBeenCalledWith(error, {
      tags: { context: "pos.catalog.save" },
    });
  });
});
