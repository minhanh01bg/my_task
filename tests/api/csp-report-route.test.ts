import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { logger } from "@/lib/logger";
import { POST } from "@/app/api/csp-report/route";

describe("POST /api/csp-report", () => {
  it("logs report-only violations with logger.info and returns 204", async () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});

    const request = new NextRequest("http://127.0.0.1:3000/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/csp-report" },
      body: JSON.stringify({
        "csp-report": {
          "document-uri": "http://160.250.247.137:3000/admin/products",
          "blocked-uri": "eval",
          "violated-directive": "script-src",
          disposition: "report",
        },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(204);
    expect(infoSpy).toHaveBeenCalledWith("CSP Violation reported", {
      category: "csp.violation",
      directive: "script-src",
      blockedUri: "eval",
      documentUri: "http://160.250.247.137:3000/admin/products",
      disposition: "report",
    });
    expect(warnSpy).not.toHaveBeenCalled();

    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("logs enforced violations with logger.warn", async () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});

    const request = new NextRequest("http://127.0.0.1:3000/api/csp-report", {
      method: "POST",
      headers: { "Content-Type": "application/csp-report" },
      body: JSON.stringify({
        "csp-report": {
          "document-uri": "http://160.250.247.137:3000/admin/products",
          "blocked-uri": "https://malicious.example.com/evil.js",
          "effective-directive": "script-src",
          disposition: "enforce",
        },
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(204);
    expect(warnSpy).toHaveBeenCalledWith("CSP Violation reported", {
      category: "csp.violation",
      directive: "script-src",
      blockedUri: "https://malicious.example.com/evil.js",
      documentUri: "http://160.250.247.137:3000/admin/products",
      disposition: "enforce",
    });
    expect(infoSpy).not.toHaveBeenCalled();

    infoSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("handles malformed JSON payload gracefully and returns 204", async () => {
    const request = new NextRequest("http://127.0.0.1:3000/api/csp-report", {
      method: "POST",
      body: "invalid-json",
    });

    const response = await POST(request);
    expect(response.status).toBe(204);
  });
});
