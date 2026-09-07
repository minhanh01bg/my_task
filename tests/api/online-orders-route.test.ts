import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/online/orders/route";
import * as createOnlineOrderModule from "@/server/orders/create-online-order";
import { setCheckoutAbuseLimiter } from "@/server/security/checkout-abuse";
import type { RateLimiter } from "@/server/security/rate-limit";

const fakePassLimiter: RateLimiter = {
  async check() {
    return {
      allowed: true as const,
      remaining: 10,
      limit: 10,
      resetInSeconds: 60,
    };
  },
};

describe("POST /api/online/orders (Task 4 & Task 5: Hard limits and Anti-Abuse)", () => {
  beforeEach(() => {
    setCheckoutAbuseLimiter(fakePassLimiter);
  });

  afterEach(() => {
    setCheckoutAbuseLimiter(null);
  });

  it("rejects oversized declared Content-Length with 413 and no-store", async () => {
    const createSpy = vi.spyOn(createOnlineOrderModule, "createOnlineOrder");

    const req = new Request("https://example.com/api/online/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "content-length": "65000",
      },
      body: JSON.stringify({ items: [] }),
    });

    const response = await POST(req);
    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("rejects chunked stream crossing 64 KB with 413 without running business logic", async () => {
    const createSpy = vi.spyOn(createOnlineOrderModule, "createOnlineOrder");

    const chunk1 = new Uint8Array(40_000).fill(65);
    const chunk2 = new Uint8Array(30_000).fill(66);
    let chunkIndex = 0;
    const chunks = [chunk1, chunk2];

    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        if (chunkIndex < chunks.length) {
          controller.enqueue(chunks[chunkIndex++]);
        } else {
          controller.close();
        }
      },
    });

    const req = new Request("https://example.com/api/online/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: stream,
      // @ts-expect-error duplex
      duplex: "half",
    });

    const response = await POST(req);
    expect(response.status).toBe(413);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("rejects non-JSON content-type with 415 and no-store", async () => {
    const createSpy = vi.spyOn(createOnlineOrderModule, "createOnlineOrder");

    const req = new Request("https://example.com/api/online/orders", {
      method: "POST",
      headers: {
        "content-type": "text/plain",
      },
      body: "plain text",
    });

    const response = await POST(req);
    expect(response.status).toBe(415);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON with 400 and no-store", async () => {
    const createSpy = vi.spyOn(createOnlineOrderModule, "createOnlineOrder");

    const req = new Request("https://example.com/api/online/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: "{ not valid json }",
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("rejects invalid schema with 400 and no-store", async () => {
    const createSpy = vi.spyOn(createOnlineOrderModule, "createOnlineOrder");

    const req = new Request("https://example.com/api/online/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ invalidField: "test" }),
    });

    const response = await POST(req);
    expect(response.status).toBe(400);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(createSpy).not.toHaveBeenCalled();
  });

  it("rejects requests exceeding IP/subnet rate limits with 429 and Retry-After", async () => {
    const createSpy = vi.spyOn(createOnlineOrderModule, "createOnlineOrder");

    const blockingLimiter: RateLimiter = {
      async check() {
        return {
          allowed: false as const,
          reason: "rate_limited" as const,
          retryAfterSeconds: 45,
          limit: 10,
          remaining: 0 as const,
        };
      },
    };
    setCheckoutAbuseLimiter(blockingLimiter);

    const req = new Request("https://example.com/api/online/orders", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ clientId: "test", customer: {}, items: [] }),
    });

    const response = await POST(req);
    expect(response.status).toBe(429);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("retry-after")).toBe("45");
    expect(createSpy).not.toHaveBeenCalled();
  });
});
