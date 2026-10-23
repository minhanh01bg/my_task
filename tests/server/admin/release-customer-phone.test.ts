import { revalidatePath } from "next/cache";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { releaseCustomerPhoneAction } from "@/app/(management)/admin/customers/actions";
import {
  ADMIN_UNAUTHORIZED_MESSAGE,
  INVALID_INPUT_MESSAGE,
} from "@/server/admin/admin-action";
import { createAdminSession, SESSION_COOKIE } from "@/server/auth/session";
import { registerCustomerAccountWithOptionalSession } from "@/server/customer-auth/session";
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

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const PHONE = "0911222333";
const PHONE_WITH_ORDER = "0911222444";
const PRODUCT_ID = "release-phone-product";
const ORDER_CODE = "RELEASE-PHONE-1";

async function resetFixtures() {
  await prisma.productReview.deleteMany({ where: { productId: PRODUCT_ID } });
  await prisma.product.deleteMany({ where: { id: PRODUCT_ID } });
  await prisma.order.deleteMany({ where: { code: ORDER_CODE } });
  await prisma.customerAccount.deleteMany({
    where: { phoneNormalized: { in: [PHONE, PHONE_WITH_ORDER] } },
  });
}

async function createAccount(phoneNormalized: string) {
  const account = await prisma.customerAccount.create({
    data: {
      phoneNormalized,
      displayName: "Người chiếm số",
      passwordHash: "dummy-hash",
    },
  });
  await prisma.customerSession.create({
    data: {
      accountId: account.id,
      tokenHash: `release-phone-${account.id}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    },
  });
  await prisma.customerNotification.create({
    data: {
      accountId: account.id,
      eventKey: `release-phone-${account.id}`,
      kind: "order_status",
      title: "Thông báo",
      body: "Nội dung",
      href: "/account",
    },
  });
  return account;
}

async function signInAdmin() {
  const { token } = await createAdminSession();
  mockCookies.set(SESSION_COOKIE, token);
}

function registerAgain(phoneNormalized: string) {
  return registerCustomerAccountWithOptionalSession({
    phoneNormalized,
    displayName: "Chủ số thật",
    passwordHash: "dummy-hash",
  });
}

beforeEach(async () => {
  mockCookies.clear();
  vi.clearAllMocks();
  await resetFixtures();
});

afterAll(resetFixtures);

describe("releaseCustomerPhoneAction", () => {
  it("tài khoản chưa có đơn: xoá hẳn, dọn dữ liệu phụ và cho đăng ký lại số đó", async () => {
    await signInAdmin();
    const account = await createAccount(PHONE);
    await prisma.product.create({
      data: { id: PRODUCT_ID, name: "Sản phẩm kiểm thử" },
    });
    const review = await prisma.productReview.create({
      data: {
        productId: PRODUCT_ID,
        accountId: account.id,
        authorName: "Người chiếm số",
        rating: 5,
        content: "Tốt",
      },
    });

    await expect(releaseCustomerPhoneAction(account.id)).resolves.toEqual({
      ok: true,
    });

    expect(
      await prisma.customerAccount.findUnique({ where: { id: account.id } }),
    ).toBeNull();
    expect(
      await prisma.customerSession.count({ where: { accountId: account.id } }),
    ).toBe(0);
    expect(
      await prisma.customerNotification.count({
        where: { accountId: account.id },
      }),
    ).toBe(0);
    // Đánh giá công khai giữ nguyên nội dung, chỉ không còn gắn tài khoản.
    await expect(
      prisma.productReview.findUnique({ where: { id: review.id } }),
    ).resolves.toMatchObject({ accountId: null, content: "Tốt" });

    await expect(registerAgain(PHONE)).resolves.toMatchObject({
      status: "created",
    });

    const audit = await prisma.adminAuditEvent.findFirst({
      where: { action: "customer_account.release_phone", entityId: account.id },
    });
    expect(audit?.entityType).toBe("customer_account");
    expect(audit?.metadata ?? "").not.toContain(PHONE);
    expect(revalidatePath).toHaveBeenCalledWith("/admin/customers");
  });

  it("tài khoản đã có đơn: từ chối, giữ nguyên tài khoản, phiên và đơn", async () => {
    await signInAdmin();
    const account = await createAccount(PHONE_WITH_ORDER);
    const order = await prisma.order.create({
      data: {
        code: ORDER_CODE,
        clientId: "release-phone-client-1",
        channel: "online",
        status: "pending",
        customerAccountId: account.id,
      },
    });

    const result = await releaseCustomerPhoneAction(account.id);

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("đơn hàng");
    expect(
      await prisma.customerAccount.findUnique({ where: { id: account.id } }),
    ).not.toBeNull();
    expect(
      await prisma.customerSession.count({ where: { accountId: account.id } }),
    ).toBe(1);
    expect(
      await prisma.customerNotification.count({
        where: { accountId: account.id },
      }),
    ).toBe(1);
    await expect(
      prisma.order.findUnique({ where: { id: order.id } }),
    ).resolves.toMatchObject({ customerAccountId: account.id });
    await expect(registerAgain(PHONE_WITH_ORDER)).resolves.toEqual({
      status: "exists",
    });
    expect(
      await prisma.adminAuditEvent.count({
        where: {
          action: "customer_account.release_phone",
          entityId: account.id,
        },
      }),
    ).toBe(0);
  });

  it("chưa đăng nhập admin: báo lỗi quyền và không xoá gì", async () => {
    const account = await createAccount(PHONE);

    await expect(releaseCustomerPhoneAction(account.id)).resolves.toEqual({
      ok: false,
      message: ADMIN_UNAUTHORIZED_MESSAGE,
    });
    expect(
      await prisma.customerAccount.findUnique({ where: { id: account.id } }),
    ).not.toBeNull();
    expect(
      await prisma.customerSession.count({ where: { accountId: account.id } }),
    ).toBe(1);
  });

  it.each(["", "x".repeat(65)])(
    "id không hợp lệ (%#): báo dữ liệu không hợp lệ",
    async (accountId) => {
      await signInAdmin();

      await expect(releaseCustomerPhoneAction(accountId)).resolves.toEqual({
        ok: false,
        message: INVALID_INPUT_MESSAGE,
      });
    },
  );

  it("không tìm thấy tài khoản: báo lỗi, không ghi audit", async () => {
    await signInAdmin();

    await expect(
      releaseCustomerPhoneAction("tai-khoan-khong-ton-tai"),
    ).resolves.toEqual({ ok: false, message: "Không tìm thấy tài khoản" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});
