import { describe, expect, it } from "vitest";

import { resolveTrustedClientIp } from "@/server/http/client-ip";

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("https://example.com/api/test", {
    headers: new Headers(headers),
  });
}

describe("resolveTrustedClientIp", () => {
  describe("Cloudflare mode", () => {
    const opts = { mode: "cloudflare" as const, isProduction: true };

    it("resolves valid IPv4 from cf-connecting-ip", () => {
      const req = makeRequest({ "cf-connecting-ip": "203.0.113.195" });
      const res = resolveTrustedClientIp(req, opts);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.ip).toBe("203.0.113.195");
        expect(res.family).toBe("ipv4");
        expect(res.subnet).toBe("203.0.113.0/24");
        expect(res.isPrivate).toBe(false);
        expect(res.isLoopback).toBe(false);
      }
    });

    it("ignores spoofed x-forwarded-for header", () => {
      const req = makeRequest({
        "cf-connecting-ip": "203.0.113.195",
        "x-forwarded-for": "198.51.100.1, 10.0.0.1",
      });
      const res = resolveTrustedClientIp(req, opts);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.ip).toBe("203.0.113.195");
      }
    });

    it("fails closed when cf-connecting-ip is missing", () => {
      const req = makeRequest({ "x-forwarded-for": "203.0.113.195" });
      const res = resolveTrustedClientIp(req, opts);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("missing_header");
      }
    });

    it("rejects malformed IP", () => {
      const req = makeRequest({ "cf-connecting-ip": "999.999.999.999" });
      const res = resolveTrustedClientIp(req, opts);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("invalid_ip");
      }
    });

    it("rejects multiple conflicting values in cf-connecting-ip", () => {
      const req = makeRequest({
        "cf-connecting-ip": "203.0.113.195, 198.51.100.2",
      });
      const res = resolveTrustedClientIp(req, opts);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("invalid_ip");
      }
    });
  });

  describe("Vercel mode", () => {
    const opts = { mode: "vercel" as const, isProduction: true };

    it("resolves from x-vercel-forwarded-for", () => {
      const req = makeRequest({
        "x-vercel-forwarded-for": "198.51.100.5",
        "x-forwarded-for": "203.0.113.1",
      });
      const res = resolveTrustedClientIp(req, opts);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.ip).toBe("198.51.100.5");
        expect(res.subnet).toBe("198.51.100.0/24");
      }
    });

    it("falls back to x-real-ip if x-vercel-forwarded-for is missing", () => {
      const req = makeRequest({ "x-real-ip": "198.51.100.6" });
      const res = resolveTrustedClientIp(req, opts);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.ip).toBe("198.51.100.6");
      }
    });
  });

  describe("Custom proxy mode", () => {
    const opts = {
      mode: "custom" as const,
      customHeader: "x-my-trusted-ip",
      isProduction: true,
    };

    it("resolves from configured custom header", () => {
      const req = makeRequest({ "x-my-trusted-ip": "198.51.100.77" });
      const res = resolveTrustedClientIp(req, opts);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.ip).toBe("198.51.100.77");
      }
    });

    it("fails when custom header is missing in production", () => {
      const req = makeRequest({ "x-forwarded-for": "198.51.100.77" });
      const res = resolveTrustedClientIp(req, opts);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("missing_header");
      }
    });
  });

  describe("IP normalization and classification", () => {
    const opts = { mode: "cloudflare" as const, isProduction: true };

    it("normalizes IPv4-mapped IPv6 addresses", () => {
      const req = makeRequest({ "cf-connecting-ip": "::ffff:198.51.100.42" });
      const res = resolveTrustedClientIp(req, opts);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.ip).toBe("198.51.100.42");
        expect(res.family).toBe("ipv4");
        expect(res.subnet).toBe("198.51.100.0/24");
      }
    });

    it("normalizes canonical IPv6 addresses and calculates /64 subnet", () => {
      const req = makeRequest({
        "cf-connecting-ip": "2001:0db8:85a3:0000:0000:8a2e:0370:7334",
      });
      const res = resolveTrustedClientIp(req, opts);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.family).toBe("ipv6");
        expect(res.subnet).toBe("2001:db8:85a3::/64");
        expect(res.isPrivate).toBe(false);
      }
    });

    it("identifies private IPv4 addresses", () => {
      const req = makeRequest({ "cf-connecting-ip": "10.1.2.3" });
      const res = resolveTrustedClientIp(req, opts);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.isPrivate).toBe(true);
        expect(res.isLoopback).toBe(false);
      }
    });

    it("identifies loopback IPv4 and IPv6 addresses", () => {
      const reqV4 = makeRequest({ "cf-connecting-ip": "127.0.0.1" });
      const resV4 = resolveTrustedClientIp(reqV4, opts);
      expect(resV4.ok).toBe(true);
      if (resV4.ok) {
        expect(resV4.isLoopback).toBe(true);
        expect(resV4.isPrivate).toBe(true);
      }

      const reqV6 = makeRequest({ "cf-connecting-ip": "::1" });
      const resV6 = resolveTrustedClientIp(reqV6, opts);
      expect(resV6.ok).toBe(true);
      if (resV6.ok) {
        expect(resV6.isLoopback).toBe(true);
        expect(resV6.isPrivate).toBe(true);
      }
    });
  });

  describe("Production vs Dev/Test direct connection (mode: none)", () => {
    it("fails closed in production when mode is none", () => {
      const req = makeRequest({});
      const res = resolveTrustedClientIp(req, {
        mode: "none",
        isProduction: true,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toBe("untrusted_proxy_mode");
      }
    });

    it("allows loopback in development/test when mode is none", () => {
      const req = makeRequest({});
      const res = resolveTrustedClientIp(req, {
        mode: "none",
        isProduction: false,
      });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.ip).toBe("127.0.0.1");
        expect(res.isLoopback).toBe(true);
      }
    });
  });
});
