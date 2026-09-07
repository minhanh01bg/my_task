import { describe, expect, it } from "vitest";

import {
  hasSafeMutationOrigin,
  validateMutationOrigin,
} from "@/server/http/origin";

describe("Fail-closed Origin & CSRF Validation (Task 10)", () => {
  const prodOpts = {
    canonicalOrigin: "https://shop.example.com",
    isProduction: true,
  };

  it("accepts exact canonical production Origin", () => {
    const req = new Request(
      "https://shop.example.com/api/customer-auth/logout",
      {
        method: "POST",
        headers: {
          origin: "https://shop.example.com",
          "sec-fetch-site": "same-origin",
        },
      },
    );

    const result = validateMutationOrigin(req, prodOpts);
    expect(result.ok).toBe(true);
    expect(hasSafeMutationOrigin(req, prodOpts)).toBe(true);
  });

  it("always rejects Sec-Fetch-Site: cross-site regardless of Origin header", () => {
    const req = new Request(
      "https://shop.example.com/api/customer-auth/logout",
      {
        method: "POST",
        headers: {
          origin: "https://shop.example.com",
          "sec-fetch-site": "cross-site",
        },
      },
    );

    const result = validateMutationOrigin(req, prodOpts);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.reason).toBe("cross_site_fetch");
    }
  });

  it("rejects missing Origin header in production", () => {
    const req = new Request(
      "https://shop.example.com/api/customer-auth/logout",
      {
        method: "POST",
      },
    );

    const result = validateMutationOrigin(req, prodOpts);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.reason).toBe("missing_origin");
    }
  });

  it("rejects null or opaque Origin", () => {
    const req = new Request(
      "https://shop.example.com/api/customer-auth/logout",
      {
        method: "POST",
        headers: { origin: "null" },
      },
    );

    const result = validateMutationOrigin(req, prodOpts);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.reason).toBe("null_origin");
    }
  });

  it("rejects malformed Origin header", () => {
    const req = new Request(
      "https://shop.example.com/api/customer-auth/logout",
      {
        method: "POST",
        headers: { origin: "not an url ://" },
      },
    );

    const result = validateMutationOrigin(req, prodOpts);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.reason).toBe("malformed_origin");
    }
  });

  it("rejects mismatched scheme (http vs https)", () => {
    const req = new Request(
      "https://shop.example.com/api/customer-auth/logout",
      {
        method: "POST",
        headers: { origin: "http://shop.example.com" },
      },
    );

    const result = validateMutationOrigin(req, prodOpts);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.reason).toBe("origin_mismatch");
    }
  });

  it("rejects mismatched port", () => {
    const req = new Request(
      "https://shop.example.com/api/customer-auth/logout",
      {
        method: "POST",
        headers: { origin: "https://shop.example.com:8443" },
      },
    );

    const result = validateMutationOrigin(req, prodOpts);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.reason).toBe("origin_mismatch");
    }
  });

  it("rejects cross-origin domain or subdomain", () => {
    const req = new Request(
      "https://shop.example.com/api/customer-auth/logout",
      {
        method: "POST",
        headers: { origin: "https://attacker.example.com" },
      },
    );

    const result = validateMutationOrigin(req, prodOpts);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.reason).toBe("origin_mismatch");
    }
  });
});
