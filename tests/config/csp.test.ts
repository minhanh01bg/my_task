import { describe, expect, it } from "vitest";

import {
  buildCspHeader,
  parseCspDirectives,
  sanitizeCspReport,
} from "@/server/security/csp";

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
  });
});
