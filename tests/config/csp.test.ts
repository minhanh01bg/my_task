import { describe, expect, it } from "vitest";

import {
  buildCspHeader,
  buildCspHeaders,
  extractCspReports,
  parseCspDirectives,
  sanitizeCspReport,
} from "@/server/security/csp";

const BASELINE_DIRECTIVES = {
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "frame-ancestors": ["'none'"],
  "form-action": ["'self'"],
  "report-uri": ["/api/csp-report"],
};

function headerValue(
  headers: { key: string; value: string }[],
  key: string,
): string | undefined {
  return headers.find((header) => header.key === key)?.value;
}

describe("Content Security Policy (Task 14)", () => {
  describe("buildCspHeader", () => {
    it("generates restrictive baseline directives in production mode", () => {
      const { headerName, headerValue } = buildCspHeader({
        isDev: false,
        mode: "enforce",
      });

      expect(headerName).toBe("Content-Security-Policy");
      const directives = parseCspDirectives(headerValue);

      // Verify all required restrictive directives exist
      expect(directives["default-src"]).toEqual(["'self'"]);
      expect(directives["object-src"]).toEqual(["'none'"]);
      expect(directives["frame-ancestors"]).toEqual(["'none'"]);
      expect(directives["base-uri"]).toEqual(["'self'"]);
      expect(directives["form-action"]).toEqual(["'self'"]);
      expect(directives["style-src"]).toContain("'self'");
      expect(directives["style-src"]).toContain("'unsafe-inline'");
      expect(directives["img-src"]).toContain("'self'");
      expect(directives["img-src"]).toContain("data:");
      expect(directives["img-src"]).toContain("blob:");
      expect(directives["connect-src"]).toContain("'self'");
    });

    it("never includes broad wildcard '*' in any directive", () => {
      const { headerValue } = buildCspHeader({
        isDev: false,
        mode: "enforce",
      });

      const directives = parseCspDirectives(headerValue);
      for (const [directive, values] of Object.entries(directives)) {
        for (const val of values) {
          expect(
            val,
            `Directive ${directive} contains broad wildcard`,
          ).not.toBe("*");
          expect(
            val,
            `Directive ${directive} contains broad wildcard`,
          ).not.toBe("'*'");
        }
      }
    });

    it("never includes 'unsafe-eval' in production mode", () => {
      const prodHeader = buildCspHeader({
        isDev: false,
        mode: "enforce",
      });
      const prodDirectives = parseCspDirectives(prodHeader.headerValue);
      expect(prodDirectives["script-src"]).not.toContain("'unsafe-eval'");
    });

    it("allows 'unsafe-eval' strictly in development mode for HMR", () => {
      const devHeader = buildCspHeader({
        isDev: true,
        mode: "report-only",
      });
      const devDirectives = parseCspDirectives(devHeader.headerValue);
      expect(devDirectives["script-src"]).toContain("'unsafe-eval'");
    });

    it("supports nonce-based script-src when nonce is provided", () => {
      const nonce = "rAnd0mN0nc3Valu3==";
      const { headerValue } = buildCspHeader({
        isDev: false,
        mode: "enforce",
        nonce,
      });

      const directives = parseCspDirectives(headerValue);
      expect(directives["script-src"]).toContain(`'nonce-${nonce}'`);
    });

    it("respects CSP mode: report-only vs enforce vs disabled", () => {
      const reportOnly = buildCspHeader({ mode: "report-only" });
      expect(reportOnly.headerName).toBe("Content-Security-Policy-Report-Only");
      expect(reportOnly.headerValue).toBeTruthy();

      const enforce = buildCspHeader({ mode: "enforce" });
      expect(enforce.headerName).toBe("Content-Security-Policy");
      expect(enforce.headerValue).toBeTruthy();

      const disabled = buildCspHeader({ mode: "disabled" });
      expect(disabled.headerName).toBeNull();
      expect(disabled.headerValue).toBeNull();
    });

    it("allowlists Sentry ingest origin when NEXT_PUBLIC_SENTRY_DSN is configured", () => {
      const { headerValue } = buildCspHeader({
        sentryDsn: "https://abcdef123456@o999999.ingest.sentry.io/1234567",
      });

      const directives = parseCspDirectives(headerValue);
      expect(directives["connect-src"]).toContain(
        "https://o999999.ingest.sentry.io",
      );
    });

    it("allowlists Vercel analytics and script origins", () => {
      const { headerValue } = buildCspHeader({});
      const directives = parseCspDirectives(headerValue);

      expect(directives["script-src"]).toContain(
        "https://va.vercel-scripts.com",
      );
      expect(directives["connect-src"]).toContain(
        "https://vitals.vercel-insights.com",
      );
      expect(directives["connect-src"]).toContain(
        "https://va.vercel-scripts.com",
      );
    });

    it("includes safe report-uri directive", () => {
      const { headerValue } = buildCspHeader({});
      const directives = parseCspDirectives(headerValue);

      expect(directives["report-uri"]).toEqual(["/api/csp-report"]);
    });

    it("allows configured image origins without wildcards", () => {
      const { headerValue } = buildCspHeader({
        extraImageOrigins: ["https://images.unsplash.com"],
      });

      const directives = parseCspDirectives(headerValue);
      expect(directives["img-src"]).toContain("https://images.unsplash.com");
      expect(directives["img-src"]).not.toContain("*");
    });
  });

  describe("buildCspHeaders (WEB-3)", () => {
    it.each(["report-only", "disabled"] as const)(
      "production %s mode still enforces the baseline policy",
      (mode) => {
        const headers = buildCspHeaders({ isDev: false, mode });

        const enforced = headerValue(headers, "Content-Security-Policy");
        expect(parseCspDirectives(enforced)).toEqual(BASELINE_DIRECTIVES);
      },
    );

    it("keeps the full report-only policy next to the enforced baseline", () => {
      const headers = buildCspHeaders({ isDev: false, mode: "report-only" });

      expect(headers.map((header) => header.key).sort()).toEqual([
        "Content-Security-Policy",
        "Content-Security-Policy-Report-Only",
      ]);
      expect(headerValue(headers, "Content-Security-Policy-Report-Only")).toBe(
        buildCspHeader({ isDev: false, mode: "report-only" }).headerValue,
      );
    });

    it("sends a single full policy in enforce mode", () => {
      const headers = buildCspHeaders({ isDev: false, mode: "enforce" });

      expect(headers).toEqual([
        {
          key: "Content-Security-Policy",
          value: buildCspHeader({ isDev: false, mode: "enforce" }).headerValue,
        },
      ]);
      const directives = parseCspDirectives(headers[0].value);
      for (const [directive, values] of Object.entries(BASELINE_DIRECTIVES)) {
        expect(directives[directive]).toEqual(values);
      }
    });

    it("never needs a nonce, so static and ISR pages keep working", () => {
      const headers = buildCspHeaders({ isDev: false, mode: "report-only" });
      for (const { value } of headers) {
        expect(value).not.toContain("nonce-");
      }
    });

    it("leaves development unchanged", () => {
      expect(buildCspHeaders({ isDev: true, mode: "report-only" })).toEqual([
        {
          key: "Content-Security-Policy-Report-Only",
          value: buildCspHeader({ isDev: true, mode: "report-only" })
            .headerValue,
        },
      ]);
      expect(buildCspHeaders({ isDev: true, mode: "disabled" })).toEqual([]);
    });
  });

  describe("sanitizeCspReport", () => {
    it("strips sensitive tokens and queries from document-uri and blocked-uri", () => {
      const rawReport = {
        "csp-report": {
          "document-uri":
            "https://shop.example.com/orders/guest/secret-guest-token-12345?foo=bar#hash",
          "blocked-uri":
            "https://attacker.example.com/steal?nonce=secret-nonce-val",
          "violated-directive": "script-src",
          "original-policy": "default-src 'self'",
          disposition: "report",
          "status-code": 200,
        },
      };

      const sanitized = sanitizeCspReport(rawReport);
      expect(sanitized["document-uri"]).toBe(
        "https://shop.example.com/orders/guest/[REDACTED]",
      );
      expect(sanitized["blocked-uri"]).toBe(
        "https://attacker.example.com/steal",
      );
      expect(sanitized["violated-directive"]).toBe("script-src");
      expect(sanitized["status-code"]).toBe(200);
    });

    it("sanitizes source-file paths and redacts order-success nonces", () => {
      const rawReport = {
        "csp-report": {
          "document-uri":
            "https://shop.example.com/order-success/0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
          "source-file":
            "https://shop.example.com/static/js/main.js?token=secret123",
          "violated-directive": "style-src",
        },
      };

      const sanitized = sanitizeCspReport(rawReport);
      expect(sanitized["document-uri"]).toBe(
        "https://shop.example.com/order-success/[REDACTED]",
      );
      expect(sanitized["source-file"]).toBe(
        "https://shop.example.com/static/js/main.js",
      );
    });

    it("preserves CSP special keywords like 'eval' and 'inline' without placeholder domains", () => {
      const rawReport = {
        "csp-report": {
          "document-uri": "http://160.250.247.137:3000/admin/products",
          "blocked-uri": "eval",
          "violated-directive": "script-src",
          disposition: "report",
        },
      };

      const sanitized = sanitizeCspReport(rawReport);
      expect(sanitized["blocked-uri"]).toBe("eval");
      expect(sanitized["blocked-uri"]).not.toContain("placeholder.internal");
      expect(sanitized["document-uri"]).toBe(
        "http://160.250.247.137:3000/admin/products",
      );
    });

    it("preserves 'inline' keyword without placeholder domains", () => {
      const rawReport = {
        "csp-report": {
          "document-uri": "https://shop.example.com/admin/products",
          "blocked-uri": "inline",
          "violated-directive": "script-src",
        },
      };

      const sanitized = sanitizeCspReport(rawReport);
      expect(sanitized["blocked-uri"]).toBe("inline");
      expect(sanitized["blocked-uri"]).not.toContain("placeholder.internal");
    });

    it("handles relative source-file paths without prepending placeholder domain", () => {
      const rawReport = {
        "csp-report": {
          "source-file": "/_next/static/chunks/app.js?v=abc123#frag",
        },
      };

      const sanitized = sanitizeCspReport(rawReport);
      expect(sanitized["source-file"]).toBe("/_next/static/chunks/app.js");
      expect(sanitized["source-file"]).not.toContain("placeholder.internal");
    });

    it("keeps only whitelisted fields (WEB-4)", () => {
      const sanitized = sanitizeCspReport({
        "csp-report": {
          "document-uri": "https://shop.example.com/admin",
          referrer: "https://shop.example.com/login?next=/admin",
          "violated-directive": "script-src-elem",
          "effective-directive": "script-src-elem",
          "original-policy": "default-src 'self'",
          "script-sample": "alert(document.cookie)",
          "blocked-uri": "inline",
          disposition: "enforce",
          "status-code": 200,
          "source-file": "https://shop.example.com/_next/static/a.js",
          "line-number": 12,
          "column-number": 34,
          "x-injected": "<script>",
        },
      });

      expect(sanitized).toEqual({
        "document-uri": "https://shop.example.com/admin",
        "violated-directive": "script-src-elem",
        "effective-directive": "script-src-elem",
        "blocked-uri": "inline",
        disposition: "enforce",
        "status-code": 200,
        "source-file": "https://shop.example.com/_next/static/a.js",
        "line-number": 12,
        "column-number": 34,
      });
    });

    it("ignores prototype keys from parsed JSON", () => {
      const sanitized = sanitizeCspReport(
        JSON.parse(
          '{"csp-report":{"__proto__":{"polluted":true},"constructor":"x","violated-directive":"img-src"}}',
        ),
      );

      expect(sanitized).toEqual({ "violated-directive": "img-src" });
      expect(Object.getPrototypeOf(sanitized)).toBe(Object.prototype);
    });

    it("drops values with the wrong type or an unknown disposition", () => {
      const sanitized = sanitizeCspReport({
        "csp-report": {
          "violated-directive": { nested: "object" },
          disposition: "monitor",
          "status-code": "200",
          "line-number": -1,
          "column-number": 1.5,
          "blocked-uri": ["https://a.example"],
        },
      });

      expect(sanitized).toEqual({});
    });

    it("truncates long strings after stripping the query string", () => {
      const longPath = `/${"a".repeat(2_000)}`;
      const sanitized = sanitizeCspReport({
        "csp-report": {
          "document-uri": `https://shop.example.com${longPath}?token=secret`,
          "violated-directive": "x".repeat(2_000),
        },
      });

      expect(sanitized["document-uri"]).toHaveLength(512);
      expect(sanitized["document-uri"]).not.toContain("token");
      expect(sanitized["violated-directive"]).toHaveLength(512);
    });

    it("ignores a null csp-report wrapper instead of throwing", () => {
      expect(sanitizeCspReport({ "csp-report": null })).toEqual({});
    });
  });

  describe("extractCspReports", () => {
    it("reads a legacy report-uri body", () => {
      expect(
        extractCspReports({
          "csp-report": {
            "document-uri": "https://shop.example.com/shop?q=1",
            "violated-directive": "img-src",
          },
        }),
      ).toEqual([
        {
          "document-uri": "https://shop.example.com/shop",
          "violated-directive": "img-src",
        },
      ]);
    });

    it("maps Reporting API csp-violation entries and skips other types", () => {
      const reports = extractCspReports([
        {
          type: "csp-violation",
          url: "https://shop.example.com/pos?session=abc",
          user_agent: "Mozilla/5.0",
          body: {
            documentURL: "https://shop.example.com/pos?session=abc",
            effectiveDirective: "connect-src",
            blockedURL: "https://evil.example/collect?c=secret",
            disposition: "report",
            statusCode: 200,
            sourceFile: "https://shop.example.com/_next/static/b.js?v=1",
            lineNumber: 1,
            columnNumber: 99,
            sample: "fetch('https://evil.example')",
            originalPolicy: "default-src 'self'",
          },
        },
        { type: "deprecation", body: { message: "old api" } },
      ]);

      expect(reports).toEqual([
        {
          "document-uri": "https://shop.example.com/pos",
          "effective-directive": "connect-src",
          "blocked-uri": "https://evil.example/collect",
          disposition: "report",
          "status-code": 200,
          "source-file": "https://shop.example.com/_next/static/b.js",
          "line-number": 1,
          "column-number": 99,
        },
      ]);
    });

    it("caps how many reports a single request can produce", () => {
      const entry = {
        type: "csp-violation",
        body: { effectiveDirective: "img-src" },
      };
      expect(extractCspReports(Array(50).fill(entry))).toHaveLength(5);
    });

    it("returns nothing for non-object bodies", () => {
      expect(extractCspReports("text")).toEqual([]);
      expect(extractCspReports(null)).toEqual([]);
      expect(extractCspReports(42)).toEqual([]);
    });
  });
});
