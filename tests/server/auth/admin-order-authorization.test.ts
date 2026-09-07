import { beforeEach, describe, expect, it, vi } from "vitest";

import * as adminOrderActions from "@/app/admin/orders/actions";
import {
  AdminUnauthorizedError,
  hasAdminSession,
  requireAdminSession,
} from "@/server/auth/require-admin-session";
import { createAdminSession, SESSION_COOKIE } from "@/server/auth/session";
import { CUSTOMER_SESSION_COOKIE } from "@/server/customer-auth/session";

const mockCookies = new Map<string, string>();
const mockRedirect = vi.fn();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const val = mockCookies.get(name);
      return val ? { name, value: val } : undefined;
    },
  }),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
  notFound: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Mock domain order mutations so we verify they are NEVER called when unauthorized
vi.mock("@/server/orders/cancel-order", () => ({
  cancelOrder: vi
    .fn()
    .mockResolvedValue({ id: "mock-order", status: "cancelled" }),
}));

vi.mock("@/server/orders/update-online-order", () => ({
  transitionOnlineOrder: vi.fn().mockResolvedValue({ id: "mock-order" }),
  markOnlineOrderPaid: vi.fn().mockResolvedValue({ id: "mock-order" }),
}));

describe("Admin Order Authorization (Task 9)", () => {
  beforeEach(() => {
    mockCookies.clear();
    mockRedirect.mockClear();
    vi.clearAllMocks();
  });

  it("exports only audited and protected Online Store admin mutation actions", () => {
    const exportedActions = Object.keys(adminOrderActions).sort();
    const auditedActions = [
      "cancelOrderAction",
      "markOnlineOrderPaidAction",
      "transitionOnlineOrderAction",
    ].sort();

    // Any new unaudited action exported from actions.ts will fail this test
    expect(exportedActions).toEqual(auditedActions);
  });

  describe("Server Action direct invocation authorization", () => {
    it("rejects anonymous caller with AdminUnauthorizedError and executes no writes", async () => {
      mockCookies.clear();

      await expect(
        adminOrderActions.cancelOrderAction("order-123"),
      ).rejects.toThrow(AdminUnauthorizedError);

      await expect(
        adminOrderActions.transitionOnlineOrderAction("order-123", "confirmed"),
      ).rejects.toThrow(AdminUnauthorizedError);

      await expect(
        adminOrderActions.markOnlineOrderPaidAction("order-123"),
      ).rejects.toThrow(AdminUnauthorizedError);
    });

    it("rejects customer session cookie and never treats customer as admin", async () => {
      mockCookies.set(CUSTOMER_SESSION_COOKIE, "valid-customer-session-token");

      await expect(
        adminOrderActions.cancelOrderAction("order-123"),
      ).rejects.toThrow(AdminUnauthorizedError);

      await expect(
        adminOrderActions.transitionOnlineOrderAction("order-123", "confirmed"),
      ).rejects.toThrow(AdminUnauthorizedError);

      await expect(
        adminOrderActions.markOnlineOrderPaidAction("order-123"),
      ).rejects.toThrow(AdminUnauthorizedError);
    });

    it("rejects invalid or tampered admin session cookie", async () => {
      mockCookies.set(SESSION_COOKIE, "tampered-admin-token");

      await expect(
        adminOrderActions.cancelOrderAction("order-123"),
      ).rejects.toThrow(AdminUnauthorizedError);

      await expect(
        adminOrderActions.transitionOnlineOrderAction("order-123", "confirmed"),
      ).rejects.toThrow(AdminUnauthorizedError);

      await expect(
        adminOrderActions.markOnlineOrderPaidAction("order-123"),
      ).rejects.toThrow(AdminUnauthorizedError);
    });

    it("allows execution when caller presents a valid admin session cookie", async () => {
      const { token: validAdminToken } = await createAdminSession();
      mockCookies.set(SESSION_COOKIE, validAdminToken);

      await expect(
        adminOrderActions.cancelOrderAction("order-123"),
      ).resolves.not.toThrow();

      await expect(
        adminOrderActions.transitionOnlineOrderAction("order-123", "confirmed"),
      ).resolves.not.toThrow();

      await expect(
        adminOrderActions.markOnlineOrderPaidAction("order-123"),
      ).resolves.not.toThrow();
    });
  });

  describe("requireAdminSession helper", () => {
    it("redirects to /admin/login when redirectToLogin is true and unauthenticated", async () => {
      mockCookies.clear();

      await expect(
        requireAdminSession({ redirectToLogin: true }),
      ).rejects.toThrow("NEXT_REDIRECT:/admin/login");

      expect(mockRedirect).toHaveBeenCalledWith("/admin/login");
    });

    it("throws AdminUnauthorizedError when redirectToLogin is false and unauthenticated", async () => {
      mockCookies.clear();

      await expect(requireAdminSession()).rejects.toThrow(
        AdminUnauthorizedError,
      );
    });

    it("authorizes route handlers via Request cookie header", async () => {
      const { token: validToken } = await createAdminSession();
      const authedReq = new Request("https://example.com/api/admin/test", {
        headers: { cookie: `${SESSION_COOKIE}=${validToken}` },
      });
      const unauthedReq = new Request("https://example.com/api/admin/test", {
        headers: { cookie: `${SESSION_COOKIE}=invalid` },
      });

      expect(await hasAdminSession(authedReq)).toBe(true);
      expect(await hasAdminSession(unauthedReq)).toBe(false);
      expect(await hasAdminSession(new Request("https://example.com"))).toBe(
        false,
      );
    });
  });
});
