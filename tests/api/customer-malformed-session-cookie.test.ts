import { describe, expect, it } from "vitest";

import { POST as logout } from "@/app/api/customer-auth/logout/route";
import { GET as listNotifications } from "@/app/api/customer/notifications/route";
import { POST as markNotificationsRead } from "@/app/api/customer/notifications/read/route";
import { POST as claimOrder } from "@/app/api/customer/orders/claim/route";
import { POST as revokeGuestAccess } from "@/app/api/customer/orders/guest-access/revoke/route";
import { CUSTOMER_SESSION_COOKIE } from "@/server/customer-auth/session";

// "%E0" is an incomplete UTF-8 escape, so decodeURIComponent throws on it.
const MALFORMED_COOKIE = `${CUSTOMER_SESSION_COOKIE}=%E0`;

function request(path: string, method = "POST"): Request {
  return new Request(`http://localhost:3000${path}`, {
    method,
    headers: {
      cookie: MALFORMED_COOKIE,
      origin: "http://localhost:3000",
      "content-type": "application/json",
    },
    body: method === "GET" ? undefined : JSON.stringify({}),
  });
}

describe("customer routes with an undecodable session cookie", () => {
  it.each([
    [
      "GET /api/customer/notifications",
      () => listNotifications(request("/api/customer/notifications", "GET")),
    ],
    [
      "POST /api/customer/notifications/read",
      () => markNotificationsRead(request("/api/customer/notifications/read")),
    ],
    [
      "POST /api/customer/orders/claim",
      () => claimOrder(request("/api/customer/orders/claim")),
    ],
    [
      "POST /api/customer/orders/guest-access/revoke",
      () =>
        revokeGuestAccess(request("/api/customer/orders/guest-access/revoke")),
    ],
  ])("%s answers 401 instead of crashing", async (_name, call) => {
    const res = await call();

    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.message).toBe("Chưa đăng nhập");
  });

  it("POST /api/customer-auth/logout still clears the cookie", async () => {
    const res = await logout(request("/api/customer-auth/logout"));

    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain(
      `${CUSTOMER_SESSION_COOKIE}=;`,
    );
  });
});
