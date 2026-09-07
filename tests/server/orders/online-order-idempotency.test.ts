import { randomBytes, randomUUID } from "node:crypto";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import {
  CHECKOUT_RECOVERY_COOKIE,
  computeCheckoutFingerprint,
  createRecoverySecret,
  decryptGuestToken,
  digestRecoverySecret,
  encryptGuestToken,
} from "@/server/orders/checkout-idempotency";
import { createOnlineOrder } from "@/server/orders/create-online-order";
import { OnlineOrderError } from "@/types/online-order";

const testProductId = "idempotency-test-product";

beforeEach(async () => {
  await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000;");
  // Clean up existing records in dependency order
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
      name: "Sản phẩm thử nghiệm Idempotency",
      price: 50_000,
      stock: 10,
      isActive: true,
      isService: false,
    },
    update: {
      name: "Sản phẩm thử nghiệm Idempotency",
      price: 50_000,
      stock: 10,
      isActive: true,
      isService: false,
      deletedAt: null,
    },
  });
});

afterEach(async () => {
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

function makeOrderInput(
  clientId = randomUUID(),
  overrides: Record<string, unknown> = {},
) {
  return {
    clientId,
    lines: [{ productId: testProductId, quantity: 1 }],
    contactName: "Nguyễn Văn A",
    contactPhone: "0901234567",
    fulfillmentType: "pickup" as const,
    paymentMethod: "cod" as const,
    deliveryAddress: "",
    deliveryWard: "",
    deliveryDistrict: "",
    deliveryProvince: "",
    note: "",
    ...overrides,
  };
}

describe("Online Order Idempotency and Guest Recovery (Task 11)", () => {
  it("encryption and decryption helper round-trips correctly and fails with wrong secret", () => {
    expect(CHECKOUT_RECOVERY_COOKIE).toBe("checkout_recovery");
    const token = "guest_cap_" + randomBytes(16).toString("hex");
    const secret = createRecoverySecret();
    const wrongSecret = createRecoverySecret();

    const encrypted = encryptGuestToken(token, secret);
    expect(encrypted).not.toContain(token);

    const decrypted = decryptGuestToken(encrypted, secret);
    expect(decrypted).toBe(token);

    const wrongDecrypted = decryptGuestToken(encrypted, wrongSecret);
    expect(wrongDecrypted).toBeNull();
  });

  it("computes deterministic fingerprint for checkout input and detects differences", () => {
    const id = randomUUID();
    const input1 = makeOrderInput(id);
    const input2 = makeOrderInput(id);
    const input3 = makeOrderInput(id, { contactPhone: "0909999999" });

    const fp1 = computeCheckoutFingerprint(input1);
    const fp2 = computeCheckoutFingerprint(input2);
    const fp3 = computeCheckoutFingerprint(input3);

    expect(fp1).toBe(fp2);
    expect(fp1).not.toBe(fp3);
  });

  it("handles concurrent requests with the same clientId, returning identical result and single execution", async () => {
    const clientId = randomUUID();
    const input = makeOrderInput(clientId);
    const recoverySecret = createRecoverySecret();

    const [res1, res2] = await Promise.all([
      createOnlineOrder(input, {
        guestAccess: {
          tokenHash: "hash1234",
          expiresAt: new Date(Date.now() + 86400000),
        },
        guestRecovery: {
          secret: recoverySecret,
          guestToken: "guest-token-1234",
        },
      }),
      createOnlineOrder(input, {
        guestAccess: {
          tokenHash: "hash1234",
          expiresAt: new Date(Date.now() + 86400000),
        },
        guestRecovery: {
          secret: recoverySecret,
          guestToken: "guest-token-1234",
        },
      }),
    ]);

    // Both requests must succeed and refer to the same order
    expect(res1.order.id).toBe(res2.order.id);
    expect(res1.order.code).toBe(res2.order.code);

    // One must be fresh, one must be duplicated
    const duplicatedStates = [res1.duplicated, res2.duplicated].sort();
    expect(duplicatedStates).toEqual([false, true]);

    // Exactly one order in DB
    const orders = await prisma.order.findMany({ where: { clientId } });
    expect(orders).toHaveLength(1);

    // Stock decremented by 1 only (10 - 1 = 9)
    const product = await prisma.product.findUnique({
      where: { id: testProductId },
    });
    expect(product?.stock).toBe(9);

    // Exactly 1 stock movement
    const movements = await prisma.stockMovement.findMany({
      where: { refId: res1.order.id },
    });
    expect(movements).toHaveLength(1);

    // Exactly 1 admin notification
    const notifications = await prisma.adminNotification.findMany({
      where: { entityId: res1.order.id },
    });
    expect(notifications).toHaveLength(1);
  });

  it("recovers guestToken when retried in the same browser with matching recovery secret", async () => {
    const clientId = randomUUID();
    const input = makeOrderInput(clientId);
    const recoverySecret = createRecoverySecret();
    const guestToken = "guest-token-secure-abc";

    // First request
    const firstRes = await createOnlineOrder(input, {
      guestAccess: {
        tokenHash: "hash-guest-abc",
        expiresAt: new Date(Date.now() + 86400000),
      },
      guestRecovery: {
        secret: recoverySecret,
        guestToken,
      },
    });
    expect(firstRes.duplicated).toBe(false);

    // Database verification: plaintext guestToken is NEVER stored in database
    const rawOrder = await prisma.order.findUnique({
      where: { clientId },
      include: {
        guestAccess: true,
        idempotency: true,
      },
    });
    expect(rawOrder?.idempotency?.encryptedGuestToken).not.toBe(guestToken);
    expect(rawOrder?.idempotency?.recoveryDigest).toBe(
      digestRecoverySecret(recoverySecret),
    );

    // Second request with SAME recoverySecret (same browser)
    const retryRes = await createOnlineOrder(input, {
      guestRecovery: {
        secret: recoverySecret,
      },
    });
    expect(retryRes.duplicated).toBe(true);
    expect(retryRes.order.id).toBe(firstRes.order.id);
    expect(retryRes.recoveredGuestToken).toBe(guestToken);

    // Third request with SAME recoverySecret: one-time consumption prevents further recovery
    const consumedRes = await createOnlineOrder(input, {
      guestRecovery: {
        secret: recoverySecret,
      },
    });
    expect(consumedRes.duplicated).toBe(true);
    expect(consumedRes.order.id).toBe(firstRes.order.id);
    expect(consumedRes.recoveredGuestToken).toBeUndefined();
  });

  it("enforces atomic one-time recovery under concurrent recovery requests", async () => {
    const clientId = randomUUID();
    const input = makeOrderInput(clientId);
    const recoverySecret = createRecoverySecret();
    const guestToken = "guest-token-concurrent-123";

    await createOnlineOrder(input, {
      guestAccess: {
        tokenHash: "hash-concurrent",
        expiresAt: new Date(Date.now() + 86400000),
      },
      guestRecovery: {
        secret: recoverySecret,
        guestToken,
      },
    });

    const results = await Promise.all([
      createOnlineOrder(input, { guestRecovery: { secret: recoverySecret } }),
      createOnlineOrder(input, { guestRecovery: { secret: recoverySecret } }),
      createOnlineOrder(input, { guestRecovery: { secret: recoverySecret } }),
    ]);

    const recoveredTokens = results
      .map((r) => r.recoveredGuestToken)
      .filter(Boolean);
    expect(recoveredTokens).toHaveLength(1);
    expect(recoveredTokens[0]).toBe(guestToken);
  });

  it("denies guest capability recovery to another browser with different or missing secret", async () => {
    const clientId = randomUUID();
    const input = makeOrderInput(clientId);
    const recoverySecret = createRecoverySecret();
    const guestToken = "guest-token-secret-xyz";

    await createOnlineOrder(input, {
      guestAccess: {
        tokenHash: "hash-xyz",
        expiresAt: new Date(Date.now() + 86400000),
      },
      guestRecovery: {
        secret: recoverySecret,
        guestToken,
      },
    });

    // Another browser retry without secret
    const noSecretRes = await createOnlineOrder(input, {});
    expect(noSecretRes.duplicated).toBe(true);
    expect(noSecretRes.recoveredGuestToken).toBeUndefined();

    // Another browser retry with wrong secret
    const wrongSecretRes = await createOnlineOrder(input, {
      guestRecovery: {
        secret: createRecoverySecret(),
      },
    });
    expect(wrongSecretRes.duplicated).toBe(true);
    expect(wrongSecretRes.recoveredGuestToken).toBeUndefined();
  });

  it("fails recovery when the recovery record is expired", async () => {
    const clientId = randomUUID();
    const input = makeOrderInput(clientId);
    const recoverySecret = createRecoverySecret();

    await createOnlineOrder(input, {
      guestAccess: {
        tokenHash: "hash-exp",
        expiresAt: new Date(Date.now() + 86400000),
      },
      guestRecovery: {
        secret: recoverySecret,
        guestToken: "guest-token-exp",
      },
    });

    // Manually expire the idempotency record
    await prisma.checkoutIdempotency.update({
      where: { clientId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const retryRes = await createOnlineOrder(input, {
      guestRecovery: { secret: recoverySecret },
    });
    expect(retryRes.duplicated).toBe(true);
    expect(retryRes.recoveredGuestToken).toBeUndefined();
  });

  it("rejects reusing clientId with different payload (409 Conflict)", async () => {
    const clientId = randomUUID();
    const input1 = makeOrderInput(clientId, { contactPhone: "0901234567" });
    const input2 = makeOrderInput(clientId, { contactPhone: "0987654321" });

    await createOnlineOrder(input1);

    await expect(createOnlineOrder(input2)).rejects.toThrow(OnlineOrderError);
    await expect(createOnlineOrder(input2)).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
    });
  });
});
