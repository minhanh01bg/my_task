import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { logger } from "@/lib/logger";
import { POST } from "@/app/api/csp-report/route";
import { setCspReportRateLimiter } from "@/server/security/csp-report-rate-limit";
import type { RateLimiter } from "@/server/security/rate-limit";

const passLimiter: RateLimiter = {
  async check() {
    return {
      allowed: true as const,
      remaining: 10,
      limit: 10,
      resetInSeconds: 60,
    };
  },
};

function cspRequest(body: string, headers: Record<string, string> = {}) {
  return new NextRequest("http://127.0.0.1:3000/api/csp-report", {
    method: "POST",
    headers: { "Content-Type": "application/csp-report", ...headers },
    body,
  });
}

describe("POST /api/csp-report", () => {
  beforeEach(() => {
    setCspReportRateLimiter(passLimiter);
  });

  afterEach(() => {
    setCspReportRateLimiter(null);
    vi.restoreAllMocks();
  });

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

  it("rejects malformed JSON with 400 and logs nothing", async () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});

    const response = await POST(cspRequest("invalid-json"));

    expect(response.status).toBe(400);
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["no content type", {}],
    ["text/plain", { "Content-Type": "text/plain" }],
    ["look-alike", { "Content-Type": "application/csp-reportx" }],
  ])(
    "rejects %s with 415 (WEB-4)",
    async (_label, headers: Record<string, string>) => {
      const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
      const request = new NextRequest("http://127.0.0.1:3000/api/csp-report", {
        method: "POST",
        headers,
        // Bytes, not a string: a string body gets an implicit text/plain type.
        body: new TextEncoder().encode(
          JSON.stringify({ "csp-report": { "violated-directive": "x" } }),
        ),
      });

      const response = await POST(request);

      expect(response.status).toBe(415);
      expect(infoSpy).not.toHaveBeenCalled();
    },
  );

  it("rejects a declared body over 16 KB before reading it", async () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const request = cspRequest("{}", { "Content-Length": "16385" });

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(request.bodyUsed).toBe(false);
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("rejects a streamed body that grows past 16 KB", async () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const padding = "a".repeat(20_000);
    const request = cspRequest(
      JSON.stringify({ "csp-report": { "script-sample": padding } }),
    );

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(infoSpy).not.toHaveBeenCalled();
  });

  it("returns 429 without reading the body or logging when the IP is over its budget", async () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const check = vi.fn<RateLimiter["check"]>().mockResolvedValue({
      allowed: false,
      reason: "rate_limited",
      retryAfterSeconds: 30,
      limit: 60,
      remaining: 0,
    });
    setCspReportRateLimiter({ check });
    const request = cspRequest(
      JSON.stringify({ "csp-report": { "violated-directive": "img-src" } }),
    );

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("30");
    expect(request.bodyUsed).toBe(false);
    expect(infoSpy).not.toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(check).toHaveBeenCalledWith(
      expect.objectContaining({ name: "csp-report", failClosed: false }),
      expect.arrayContaining([
        expect.objectContaining({ dimension: "ip", identifier: "127.0.0.1" }),
      ]),
    );
  });

  it("fails open when the limiter itself throws", async () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});
    setCspReportRateLimiter({
      check: vi.fn().mockRejectedValue(new Error("redis down")),
    });

    const response = await POST(
      cspRequest(
        JSON.stringify({ "csp-report": { "violated-directive": "img-src" } }),
      ),
    );

    expect(response.status).toBe(204);
    expect(infoSpy).toHaveBeenCalledTimes(1);
  });

  it("logs only whitelisted, query-free, truncated fields", async () => {
    const infoSpy = vi.spyOn(logger, "info").mockImplementation(() => {});

    const response = await POST(
      cspRequest(
        JSON.stringify({
          "csp-report": {
            "document-uri":
              "https://shop.example.com/orders/guest/abc?token=secret",
            referrer: "https://shop.example.com/login?next=/admin",
            "violated-directive": `img-src ${"x".repeat(1_000)}`,
            "blocked-uri": "https://evil.example/p.gif?c=document.cookie",
            "original-policy": "default-src 'self'",
            "script-sample": "alert(document.cookie)",
            disposition: "report",
            "status-code": 200,
            "source-file": "https://shop.example.com/_next/a.js?v=1",
            "line-number": 3,
            "column-number": 7,
          },
        }),
      ),
    );

    expect(response.status).toBe(204);
    expect(infoSpy).toHaveBeenCalledTimes(1);
    const payload = infoSpy.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).toEqual({
      category: "csp.violation",
      directive: `img-src ${"x".repeat(504)}`,
      blockedUri: "https://evil.example/p.gif",
      documentUri: "https://shop.example.com/orders/guest/[REDACTED]",
      disposition: "report",
      statusCode: 200,
      sourceFile: "https://shop.example.com/_next/a.js",
      lineNumber: 3,
      columnNumber: 7,
    });
    expect(JSON.stringify(payload)).not.toMatch(/secret|cookie|original/);
  });

  it("accepts Reporting API batches (application/reports+json)", async () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});

    const response = await POST(
      cspRequest(
        JSON.stringify([
          {
            type: "csp-violation",
            url: "https://shop.example.com/pos",
            body: {
              documentURL: "https://shop.example.com/pos?x=1",
              effectiveDirective: "object-src",
              blockedURL: "https://evil.example/x.swf",
              disposition: "enforce",
            },
          },
        ]),
        { "Content-Type": "application/reports+json" },
      ),
    );

    expect(response.status).toBe(204);
    expect(warnSpy).toHaveBeenCalledWith("CSP Violation reported", {
      category: "csp.violation",
      directive: "object-src",
      blockedUri: "https://evil.example/x.swf",
      documentUri: "https://shop.example.com/pos",
      disposition: "enforce",
    });
  });
});
