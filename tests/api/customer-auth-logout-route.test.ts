import { describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/customer-auth/logout/route";
import { CUSTOMER_SESSION_COOKIE } from "@/server/customer-auth/session";

vi.mock("@/server/customer-auth/session", () => ({
  CUSTOMER_SESSION_COOKIE: "customer_session",
  revokeCustomerSession: vi.fn(),
}));

describe("POST /api/customer-auth/logout", () => {
  it("rejects cross-site request with 403", async () => {
    const req = new Request("http://localhost:3000/api/customer-auth/logout", {
      method: "POST",
      headers: {
        origin: "https://evil.example",
        "sec-fetch-site": "cross-site",
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.message).toBe("Yêu cầu không hợp lệ");
  });

  it("accepts same-origin logout, clears session cookie and returns 200", async () => {
    const req = new Request("http://localhost:3000/api/customer-auth/logout", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        cookie: `${CUSTOMER_SESSION_COOKIE}=test-session-token`,
      },
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const setCookie = res.headers.get("set-cookie");
    expect(setCookie).toBeDefined();
    expect(setCookie).toContain(`${CUSTOMER_SESSION_COOKIE}=;`);
  });
});
