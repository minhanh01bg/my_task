import { randomBytes, randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import {
  createReceiptNonce,
  getPublicReceipt,
  isValidReceiptNonce,
  setReceiptRateLimiter,
} from "@/server/orders/public-receipt";
import type { RateLimiter } from "@/server/security/rate-limit";

const testProductId = "receipt-test-product";

beforeEach(async () => {
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
  await prisma.adminNotification.deleteMany();
  await prisma.checkoutIdempotency.deleteMany();
  await prisma.guestOrderAccess.deleteMany();
  await prisma.stockMovement.deleteMany({
    where: { productId: testProductId },
  });
  await prisma.orderItem.deleteMany({ where: { productId: testProductId } });
  await prisma.order.deleteMany({ where: { channel: "online" } });
  await prisma.product.upsert({
    where: { id: testProductId },
    create: {
      id: testProductId,
      name: "Sản phẩm thử nghiệm Receipt",
      price: 150_000,
      stock: 20,
      isActive: true,
      isService: false,
    },
    update: {
      name: "Sản phẩm thử nghiệm Receipt",
      price: 150_000,
      stock: 20,
      isActive: true,
      isService: false,
      deletedAt: null,
    },
  });
});

afterEach(async () => {
  setReceiptRateLimiter(null);
  await prisma.adminNotification.deleteMany();
  await prisma.checkoutIdempotency.deleteMany();
  await prisma.guestOrderAccess.deleteMany();
  await prisma.stockMovement.deleteMany({
    where: { productId: testProductId },
  });
  await prisma.orderItem.deleteMany({ where: { productId: testProductId } });
  await prisma.order.deleteMany({ where: { channel: "online" } });
  await prisma.product.deleteMany({ where: { id: testProductId } });
});

describe("Public Receipt Lookup Security (Task 12)", () => {
  it("rejects sequential order codes (e.g. DH0001) as invalid nonces", () => {
    expect(isValidReceiptNonce("DH0001")).toBe(false);
    expect(isValidReceiptNonce("DH0002")).toBe(false);
    expect(isValidReceiptNonce("order-1234")).toBe(false);
    expect(isValidReceiptNonce("123456")).toBe(false);
    expect(isValidReceiptNonce("")).toBe(false);
    expect(isValidReceiptNonce("a".repeat(63))).toBe(false);
    expect(isValidReceiptNonce("a".repeat(65))).toBe(false);
    expect(isValidReceiptNonce("g".repeat(64))).toBe(false); // Non-hex
  });

  it("validates 256-bit (64 hex characters) receipt nonces", () => {
    const { nonce } = createReceiptNonce();
    expect(nonce).toHaveLength(64);
    expect(isValidReceiptNonce(nonce)).toBe(true);
  });

  it("proves sequential codes cannot retrieve order metadata", async () => {
    // Seed an online order with sequential code DH0001
    await prisma.order.create({
      data: {
        code: "DH0001",
        channel: "online",
        status: "pending",
        subtotal: 150_000,
        total: 150_000,
        clientId: randomUUID(),
        contactName: "Khách Bí Mật",
        contactPhone: "0901234567",
        deliveryAddress: "123 Đường Nhạy Cảm",
        paymentMethod: "cod",
      },
    });

    // Attempting to lookup via sequential code returns null
    const result = await getPublicReceipt("DH0001");
    expect(result).toBeNull();
  });

  it("retrieves minimal receipt metadata using a valid 256-bit nonce", async () => {
    const { nonce, nonceHash } = createReceiptNonce();
    await prisma.order.create({
      data: {
        code: "DH0099",
        channel: "online",
        status: "pending",
        subtotal: 150_000,
        total: 150_000,
        clientId: randomUUID(),
        contactName: "Khách Hàng Thật",
        contactPhone: "0988888888",
        deliveryAddress: "456 Đường Kín Đáo",
        paymentMethod: "bank_transfer",
        receiptNonceHash: nonceHash,
      },
    });

    const receipt = await getPublicReceipt(nonce);
    expect(receipt).not.toBeNull();
    expect(receipt?.code).toBe("DH0099");
    expect(receipt?.total).toBe(150_000);
    expect(receipt?.paymentMethod).toBe("bank_transfer");

    // CRITICAL: Ensure NO PII or sensitive fields exist in receipt
    expect(receipt).not.toHaveProperty("contactName");
    expect(receipt).not.toHaveProperty("contactPhone");
    expect(receipt).not.toHaveProperty("deliveryAddress");
    expect(receipt).not.toHaveProperty("items");
    expect(receipt).not.toHaveProperty("guestAccess");
  });

  it("returns indistinguishable null for unknown random nonces or unbackfilled orders", async () => {
    const randomHex = randomBytes(32).toString("hex");
    const result = await getPublicReceipt(randomHex);
    expect(result).toBeNull();

    // Order without receipt nonce (unbackfilled)
    await prisma.order.create({
      data: {
        code: "DH0055",
        channel: "online",
        status: "pending",
        subtotal: 50_000,
        total: 50_000,
        clientId: randomUUID(),
        receiptNonceHash: null,
      },
    });
    expect(await getPublicReceipt("DH0055")).toBeNull();
  });

  it("enforces rate-limiting on receipt misses", async () => {
    let checkCount = 0;
    const testLimiter: RateLimiter = {
      async check() {
        checkCount++;
        if (checkCount > 2) {
          return {
            allowed: false as const,
            reason: "rate_limited" as const,
            retryAfterSeconds: 300,
            limit: 2,
            remaining: 0 as const,
          };
        }
        return {
          allowed: true as const,
          limit: 2,
          remaining: 2 - checkCount,
          resetInSeconds: 300,
        };
      },
    };
    setReceiptRateLimiter(testLimiter);

    const randomNonce1 = randomBytes(32).toString("hex");
    const randomNonce2 = randomBytes(32).toString("hex");
    const randomNonce3 = randomBytes(32).toString("hex");

    const dummyReq = new Request("https://example.com/order-success/test", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });

    expect(await getPublicReceipt(randomNonce1, dummyReq)).toBeNull();
    expect(await getPublicReceipt(randomNonce2, dummyReq)).toBeNull();
    // Third attempt is rate-limited
    await expect(
      getPublicReceipt(randomNonce3, dummyReq),
    ).rejects.toMatchObject({
      status: 429,
    });
  });
});
