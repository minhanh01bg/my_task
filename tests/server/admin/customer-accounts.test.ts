import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { toggleCustomerAccountDisabledAction } from "@/app/admin/customers/actions";
import { prisma } from "@/server/db/prisma";

// Mock admin session as authorized
vi.mock("@/server/auth/require-admin-session", () => ({
  requireAdminSession: vi.fn().mockResolvedValue({ authorized: true }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

beforeEach(async () => {
  await prisma.customerSession.deleteMany();
  await prisma.customerAccount.deleteMany();
});

afterAll(async () => {
  await prisma.customerSession.deleteMany();
  await prisma.customerAccount.deleteMany();
});

describe("Admin Customer Accounts Actions", () => {
  it("khóa tài khoản và thu hồi toàn bộ phiên đăng nhập khi đang hoạt động", async () => {
    const account = await prisma.customerAccount.create({
      data: {
        phoneNormalized: "0901234567",
        displayName: "Khách hàng Test",
        passwordHash: "dummy-hash",
      },
    });

    await prisma.customerSession.create({
      data: {
        accountId: account.id,
        tokenHash: "token-hash-1",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });

    const formData = new FormData();
    formData.set("accountId", account.id);

    const result = await toggleCustomerAccountDisabledAction(formData);
    expect(result).toEqual({ ok: true, disabled: true });

    const updated = await prisma.customerAccount.findUnique({
      where: { id: account.id },
    });
    expect(updated?.disabledAt).not.toBeNull();

    const activeSessions = await prisma.customerSession.findMany({
      where: { accountId: account.id },
    });
    expect(activeSessions).toHaveLength(0);
  });

  it("mở khóa tài khoản khi tài khoản đang bị khóa", async () => {
    const account = await prisma.customerAccount.create({
      data: {
        phoneNormalized: "0909876543",
        displayName: "Khách hàng Khóa",
        passwordHash: "dummy-hash",
        disabledAt: new Date(),
      },
    });

    const formData = new FormData();
    formData.set("accountId", account.id);

    const result = await toggleCustomerAccountDisabledAction(formData);
    expect(result).toEqual({ ok: true, disabled: false });

    const updated = await prisma.customerAccount.findUnique({
      where: { id: account.id },
    });
    expect(updated?.disabledAt).toBeNull();
  });
});
