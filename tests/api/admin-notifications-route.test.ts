import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/auth/require-admin-session", () => ({
  hasAdminSession: vi.fn(),
}));
vi.mock("@/server/notifications/admin-notifications", () => ({
  listAdminNotifications: vi.fn(),
  markAdminNotificationsRead: vi.fn(),
}));

import { GET } from "@/app/api/admin/notifications/route";
import { POST } from "@/app/api/admin/notifications/read/route";
import { hasAdminSession } from "@/server/auth/require-admin-session";
import {
  listAdminNotifications,
  markAdminNotificationsRead,
} from "@/server/notifications/admin-notifications";

const mockedAuth = vi.mocked(hasAdminSession);
const mockedList = vi.mocked(listAdminNotifications);
const mockedRead = vi.mocked(markAdminNotificationsRead);

const JSON_HEADERS = {
  origin: "http://localhost",
  "content-type": "application/json",
};

beforeEach(() => vi.clearAllMocks());

describe("admin notification routes", () => {
  it("từ chối unauthenticated và customer cookie", async () => {
    mockedAuth.mockResolvedValue(false);
    for (const cookie of [undefined, "customer_session=customer-only"]) {
      const response = await GET(
        new Request("http://localhost/api/admin/notifications", {
          headers: cookie ? { cookie } : undefined,
        }),
      );
      expect(response.status).toBe(401);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    }
    expect(mockedList).not.toHaveBeenCalled();
  });

  it("list yêu cầu admin và strict query", async () => {
    mockedAuth.mockResolvedValue(true);
    const invalid = await GET(
      new Request("http://localhost/api/admin/notifications?extra=x"),
    );
    expect(invalid.status).toBe(400);
    mockedList.mockResolvedValue({
      items: [],
      nextCursor: null,
      unreadCount: 0,
      cutoff: "2026-09-06T10:00:00.000Z",
    });
    const response = await GET(
      new Request("http://localhost/api/admin/notifications?limit=10"),
    );
    expect(response.status).toBe(200);
    expect(mockedList).toHaveBeenCalledWith({ limit: 10 });
  });

  it("mutation kiểm Origin và strict body", async () => {
    mockedAuth.mockResolvedValue(true);
    const crossOrigin = await POST(
      new Request("http://localhost/api/admin/notifications/read", {
        method: "POST",
        headers: { origin: "https://evil.example" },
        body: JSON.stringify({ id: "one" }),
      }),
    );
    expect(crossOrigin.status).toBe(403);
    const invalid = await POST(
      new Request("http://localhost/api/admin/notifications/read", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ id: "one", extra: true }),
      }),
    );
    expect(invalid.status).toBe(400);
    mockedRead.mockResolvedValue(0);
    const valid = await POST(
      new Request("http://localhost/api/admin/notifications/read", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ id: "one" }),
      }),
    );
    expect(valid.status).toBe(200);
  });

  it("mutation đọc body có giới hạn byte và đúng Content-Type", async () => {
    mockedAuth.mockResolvedValue(true);
    const oversized = await POST(
      new Request("http://localhost/api/admin/notifications/read", {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ id: "x".repeat(4_000) }),
      }),
    );
    expect(oversized.status).toBe(413);
    expect(oversized.headers.get("cache-control")).toBe("private, no-store");

    const wrongType = await POST(
      new Request("http://localhost/api/admin/notifications/read", {
        method: "POST",
        headers: { origin: "http://localhost", "content-type": "text/plain" },
        body: JSON.stringify({ id: "one" }),
      }),
    );
    expect(wrongType.status).toBe(415);

    const malformed = await POST(
      new Request("http://localhost/api/admin/notifications/read", {
        method: "POST",
        headers: JSON_HEADERS,
        body: "{not json",
      }),
    );
    expect(malformed.status).toBe(400);
    expect(mockedRead).not.toHaveBeenCalled();
  });
});
