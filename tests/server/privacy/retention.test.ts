import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import {
  applyOnlineStoreRetention,
  DATA_INVENTORY,
  getRetentionCutoffDate,
} from "@/server/privacy/retention";

describe("Privacy Retention and PII Controls (Task 18)", () => {
  const baseNow = new Date("2026-09-07T12:00:00.000Z");
  const ninetyDaysAgo = new Date(baseNow.getTime() - 90 * 24 * 60 * 60 * 1000);
  const oldOrderDate = new Date(ninetyDaysAgo.getTime() - 24 * 60 * 60 * 1000); // 91 days old
  const recentOrderDate = new Date(
    ninetyDaysAgo.getTime() + 24 * 60 * 60 * 1000,
  ); // 89 days old

  const testIds = {
    oldOrder: "retention-order-old",
    recentOrder: "retention-order-recent",
    legalHoldOrder: "retention-order-legal-hold",
    alreadyAnonOrder: "retention-order-already-anon",
    oldProduct: "retention-product-1",
  };

  beforeAll(async () => {
    // Clean up any stale records from prior runs
    await prisma.stockMovement.deleteMany({
      where: { refId: { in: Object.values(testIds) } },
    });
    await prisma.orderItem.deleteMany({
      where: { orderId: { in: Object.values(testIds) } },
    });
    await prisma.order.deleteMany({
      where: { id: { in: Object.values(testIds) } },
    });
    await prisma.product.deleteMany({
      where: { id: testIds.oldProduct },
    });

    // 1. Create a product and stock movement to verify financial/inventory preservation
    await prisma.product.create({
      data: {
        id: testIds.oldProduct,
        name: "Sản phẩm kiểm thử lưu trữ",
        price: 50_000,
        costPrice: 30_000,
        stock: 10,
      },
    });

    // 2. Old order (91 days old) -> should be anonymized
    await prisma.order.create({
      data: {
        id: testIds.oldOrder,
        code: "DH-OLD-01",
        clientId: "client-old-01",
        channel: "online",
        contactName: "Nguyễn Văn Cũ",
        contactPhone: "0912345678",
        deliveryAddress: "123 Đường Cũ",
        deliveryProvince: "Hà Nội",
        total: 100_000,
        createdAt: oldOrderDate,
        items: {
          create: [
            {
              nameSnapshot: "Sản phẩm kiểm thử lưu trữ",
              unitPrice: 50_000,
              originalPrice: 50_000,
              quantity: 2,
              lineTotal: 100_000,
              productId: testIds.oldProduct,
            },
          ],
        },
      },
    });

    await prisma.stockMovement.create({
      data: {
        productId: testIds.oldProduct,
        delta: -2,
        reason: "sale",
        refId: testIds.oldOrder,
      },
    });

    // 3. Recent order (89 days old) -> should NOT be touched
    await prisma.order.create({
      data: {
        id: testIds.recentOrder,
        code: "DH-RECENT-01",
        clientId: "client-recent-01",
        channel: "online",
        contactName: "Trần Thị Mới",
        contactPhone: "0987654321",
        deliveryAddress: "456 Đường Mới",
        total: 50_000,
        createdAt: recentOrderDate,
      },
    });

    // 4. Old order with legal hold -> should NOT be touched
    await prisma.order.create({
      data: {
        id: testIds.legalHoldOrder,
        code: "DH-HOLD-01",
        clientId: "client-hold-01",
        channel: "online",
        contactName: "Phạm Giữ Lại",
        contactPhone: "0977889900",
        deliveryAddress: "789 Đường Tòa Án",
        total: 200_000,
        legalHold: true,
        createdAt: oldOrderDate,
      },
    });

    // 5. Already anonymized old order -> skipped
    await prisma.order.create({
      data: {
        id: testIds.alreadyAnonOrder,
        code: "DH-ANON-01",
        clientId: "client-anon-01",
        channel: "online",
        contactName: "Khách hàng đã ẩn danh",
        contactPhone: null,
        deliveryAddress: null,
        total: 80_000,
        anonymizedAt: new Date(oldOrderDate.getTime() + 1000),
        createdAt: oldOrderDate,
      },
    });
  });

  afterAll(async () => {
    await prisma.stockMovement.deleteMany({
      where: { refId: { in: Object.values(testIds) } },
    });
    await prisma.orderItem.deleteMany({
      where: { orderId: { in: Object.values(testIds) } },
    });
    await prisma.order.deleteMany({
      where: { id: { in: Object.values(testIds) } },
    });
    await prisma.product.deleteMany({
      where: { id: testIds.oldProduct },
    });
  });

  it("data inventory classifies fields with owner, purpose, and retention duration", () => {
    expect(DATA_INVENTORY).toBeDefined();
    expect(Array.isArray(DATA_INVENTORY)).toBe(true);

    const categories = DATA_INVENTORY.map((item) => item.category);
    expect(categories).toContain("order_pii");
    expect(categories).toContain("financial_audit");
    expect(categories).toContain("transient_session");
    expect(categories).toContain("transient_capability");

    const orderPii = DATA_INVENTORY.find((i) => i.category === "order_pii");
    expect(orderPii?.actionOnExpiry).toBe("anonymize");
    expect(orderPii?.retentionDays).toBe(90);

    const financial = DATA_INVENTORY.find(
      (i) => i.category === "financial_audit",
    );
    expect(financial?.actionOnExpiry).toBe("retain");

    expect(getRetentionCutoffDate(90, baseNow).getTime()).toBe(
      ninetyDaysAgo.getTime(),
    );
  });

  it("dry-run accurately identifies eligible records without executing mutations", async () => {
    const preview = await applyOnlineStoreRetention({
      dryRun: true,
      retentionDays: 90,
      now: baseNow,
    });

    expect(preview.dryRun).toBe(true);
    expect(preview.ordersEligible).toBeGreaterThanOrEqual(1);

    // Verify in DB that no mutations occurred
    const checkOrder = await prisma.order.findUnique({
      where: { id: testIds.oldOrder },
    });
    expect(checkOrder?.contactName).toBe("Nguyễn Văn Cũ");
    expect(checkOrder?.anonymizedAt).toBeNull();
  });

  it("destructive execution anonymizes PII while strictly preserving financial and inventory records", async () => {
    const result = await applyOnlineStoreRetention({
      dryRun: false,
      retentionDays: 90,
      now: baseNow,
    });

    expect(result.dryRun).toBe(false);
    expect(result.ordersAnonymized).toBeGreaterThanOrEqual(1);

    // 1. Old order is anonymized
    const oldOrder = await prisma.order.findUnique({
      where: { id: testIds.oldOrder },
      include: { items: true },
    });
    expect(oldOrder?.contactName).toBe("Khách hàng đã ẩn danh");
    expect(oldOrder?.contactPhone).toBeNull();
    expect(oldOrder?.deliveryAddress).toBeNull();
    expect(oldOrder?.anonymizedAt).not.toBeNull();

    // Financial invariant preserved: total, code, and item line totals unchanged
    expect(oldOrder?.total).toBe(100_000);
    expect(oldOrder?.code).toBe("DH-OLD-01");
    expect(oldOrder?.items.length).toBe(1);
    expect(oldOrder?.items[0].lineTotal).toBe(100_000);

    // Inventory invariant preserved: stock movements remain intact
    const movements = await prisma.stockMovement.findMany({
      where: { refId: testIds.oldOrder },
    });
    expect(movements.length).toBe(1);
    expect(movements[0].delta).toBe(-2);

    // 2. Recent order is preserved (NOT anonymized)
    const recentOrder = await prisma.order.findUnique({
      where: { id: testIds.recentOrder },
    });
    expect(recentOrder?.contactName).toBe("Trần Thị Mới");
    expect(recentOrder?.anonymizedAt).toBeNull();

    // 3. Legal hold order is preserved (NOT anonymized)
    const holdOrder = await prisma.order.findUnique({
      where: { id: testIds.legalHoldOrder },
    });
    expect(holdOrder?.contactName).toBe("Phạm Giữ Lại");
    expect(holdOrder?.anonymizedAt).toBeNull();

    // 4. Running retention again is idempotent
    const repeat = await applyOnlineStoreRetention({
      dryRun: false,
      retentionDays: 90,
      now: baseNow,
    });
    expect(repeat.ordersAnonymized).toBe(0);
  });
});
