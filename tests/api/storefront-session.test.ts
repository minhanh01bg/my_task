import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "@/app/api/storefront/session/route";
import { isPublicPath } from "@/lib/auth/public-paths";
import { createAdminSession, SESSION_COOKIE } from "@/server/auth/session";
import {
  createCustomerSession,
  CUSTOMER_SESSION_COOKIE,
} from "@/server/customer-auth/session";
import { prisma } from "@/server/db/prisma";

const mockCookies = new Map<string, string>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = mockCookies.get(name);
      return value ? { name, value } : undefined;
    },
  }),
}));

async function readSession() {
  const response = await GET();
  return { response, body: (await response.json()) as unknown };
}

describe("GET /api/storefront/session", () => {
  beforeEach(async () => {
    mockCookies.clear();
    await prisma.customerSession.deleteMany();
    await prisma.customerAccount.deleteMany({
      where: { phoneNormalized: "+84900000991" },
    });
  });

  afterAll(async () => {
    await prisma.customerSession.deleteMany();
    await prisma.customerAccount.deleteMany({
      where: { phoneNormalized: "+84900000991" },
    });
  });

  it("là route public để khách chưa đăng nhập admin vẫn gọi được", () => {
    expect(isPublicPath("/api/storefront/session")).toBe(true);
  });

  it("trả trạng thái khách khi không có cookie, không cho cache chung", async () => {
    const { response, body } = await readSession();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body).toEqual({ isAdmin: false, isCustomer: false });
  });

  it("nhận diện phiên khách hàng hợp lệ và chỉ trả hai cờ boolean", async () => {
    const account = await prisma.customerAccount.create({
      data: {
        phoneNormalized: "+84900000991",
        displayName: "Khách phiên",
        passwordHash: "dummy",
        phoneVerifiedAt: new Date(),
      },
    });
    const { token } = await createCustomerSession(account.id);
    mockCookies.set(CUSTOMER_SESSION_COOKIE, token);

    const { response, body } = await readSession();

    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(body).toEqual({ isAdmin: false, isCustomer: true });
  });

  it("nhận diện phiên quản trị hợp lệ", async () => {
    const { token } = await createAdminSession();
    mockCookies.set(SESSION_COOKIE, token);

    const { body } = await readSession();

    expect(body).toEqual({ isAdmin: true, isCustomer: false });
  });

  it("bỏ qua cookie giả mạo", async () => {
    mockCookies.set(SESSION_COOKIE, "tampered-admin-token");
    mockCookies.set(CUSTOMER_SESSION_COOKIE, "tampered-customer-token");

    const { body } = await readSession();

    expect(body).toEqual({ isAdmin: false, isCustomer: false });
  });
});
