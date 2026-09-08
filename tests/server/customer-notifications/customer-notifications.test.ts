import { beforeEach, describe, expect, it } from "vitest";

import { prisma } from "@/server/db/prisma";
import { createOrder } from "@/server/orders/create-order";
import {
  markOnlineOrderPaid,
  transitionOnlineOrder,
} from "@/server/orders/update-online-order";
import { claimGuestOrder } from "@/server/orders/order-access";
import { digestOpaqueToken } from "@/server/customer-auth/session";
import { sanitizeNotificationBody } from "@/server/customer-notifications/create-customer-notification";

describe("Customer Notifications Domain & Atomic Order Events", () => {
  let testAccountId: string;
  let testProductId: string;

  beforeEach(async () => {
    await prisma.customerNotification.deleteMany();
    await prisma.checkoutIdempotency.deleteMany();
    await prisma.guestOrderAccess.deleteMany();
    await prisma.payment.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.stockMovement.deleteMany();
    await prisma.order.deleteMany();
    await prisma.customerSession.deleteMany();
    await prisma.customerAccount.deleteMany();
    await prisma.product.deleteMany();

    // Create a verified customer account
    const account = await prisma.customerAccount.create({
      data: {
        phoneNormalized: "+84912345678",
        displayName: "Nguyễn Văn A",
        passwordHash: "dummy_hash",
        phoneVerifiedAt: new Date(),
      },
    });
    testAccountId = account.id;

    // Create a product
    const product = await prisma.product.create({
      data: {
        name: "Sản phẩm test",
        price: 150_000,
        stock: 50,
      },
    });
    testProductId = product.id;
  });

  it("tạo đúng 1 notification khi đơn hàng online được tạo với tài khoản khách hàng", async () => {
    const res = await createOrder({
      clientId: "test-client-cust-01",
      channel: "online",
      customerAccountId: testAccountId,
      lines: [
        {
          productId: testProductId,
          name: "Sản phẩm test",
          unitPrice: 150_000,
          originalPrice: 150_000,
          quantity: 1,
          discount: 0,
          unit: "cái",
          isService: false,
        },
      ],
      payments: [
        {
          method: "transfer",
          amount: 150_000,
        },
      ],
      online: {
        fulfillmentStatus: "new",
        fulfillmentType: "delivery",
        paymentMethod: "bank_transfer",
        contactName: "Nguyễn Văn A",
        contactPhone: "0912345678",
        deliveryAddress: "123 Đường ABC",
        deliveryWard: "Phường 1",
        deliveryDistrict: "Quận 1",
        deliveryProvince: "Hồ Chí Minh",
        shippingFee: 0,
      },
    });

    const notifications = await prisma.customerNotification.findMany({
      where: { accountId: testAccountId, orderId: res.order.id },
    });

    expect(notifications).toHaveLength(1);
    expect(notifications[0].eventKey).toBe(
      `customer-order:${res.order.id}:created`,
    );
    expect(notifications[0].kind).toBe("order_created");
    expect(notifications[0].title).toBe("Đặt hàng thành công");
    expect(notifications[0].href).toBe(`/account/orders/${res.order.id}`);

    // Body phải an toàn, không chứa địa chỉ hay số điện thoại đầy đủ
    expect(notifications[0].body).toContain(res.order.code);
    expect(notifications[0].body).not.toContain("123 Đường ABC");
    expect(notifications[0].body).not.toContain("0912345678");
  });

  it("không tạo customer notification khi tạo đơn hàng khách vãng lai (guest order)", async () => {
    const res = await createOrder({
      clientId: "test-client-guest-01",
      channel: "online",
      customerAccountId: null, // Guest
      lines: [
        {
          productId: testProductId,
          name: "Sản phẩm test",
          unitPrice: 150_000,
          originalPrice: 150_000,
          quantity: 1,
          discount: 0,
          unit: "cái",
          isService: false,
        },
      ],
      payments: [
        {
          method: "transfer",
          amount: 150_000,
        },
      ],
      online: {
        fulfillmentStatus: "new",
        fulfillmentType: "delivery",
        paymentMethod: "bank_transfer",
        contactName: "Khách Vãng Lai",
        contactPhone: "0988888888",
        deliveryAddress: "456 Đường XYZ",
      },
    });

    const count = await prisma.customerNotification.count({
      where: { orderId: res.order.id },
    });
    expect(count).toBe(0);
  });

  it("tạo notification theo deterministic event key cho từng bước chuyển trạng thái đơn hàng", async () => {
    const res = await createOrder({
      clientId: "test-client-cust-02",
      channel: "online",
      customerAccountId: testAccountId,
      lines: [
        {
          productId: testProductId,
          name: "Sản phẩm test",
          unitPrice: 150_000,
          originalPrice: 150_000,
          quantity: 1,
          discount: 0,
          unit: "cái",
          isService: false,
        },
      ],
      payments: [
        {
          method: "transfer",
          amount: 150_000,
        },
      ],
      online: {
        fulfillmentStatus: "new",
        fulfillmentType: "delivery",
        paymentMethod: "bank_transfer",
        contactName: "Nguyễn Văn A",
        contactPhone: "0912345678",
      },
    });

    // new -> confirmed
    await transitionOnlineOrder(res.order.id, "confirmed");
    // confirmed -> preparing
    await transitionOnlineOrder(res.order.id, "preparing");
    // preparing -> ready
    await transitionOnlineOrder(res.order.id, "ready");
    // ready -> completed
    await transitionOnlineOrder(res.order.id, "completed");

    const notifications = await prisma.customerNotification.findMany({
      where: { accountId: testAccountId, orderId: res.order.id },
      orderBy: { createdAt: "asc" },
    });

    // 1 created + 4 status transitions = 5
    expect(notifications).toHaveLength(5);

    const eventKeys = notifications.map((n) => n.eventKey);
    expect(eventKeys).toEqual([
      `customer-order:${res.order.id}:created`,
      `customer-order:${res.order.id}:status:confirmed`,
      `customer-order:${res.order.id}:status:preparing`,
      `customer-order:${res.order.id}:status:ready`,
      `customer-order:${res.order.id}:status:completed`,
    ]);

    const completedNotif = notifications.find(
      (n) => n.eventKey === `customer-order:${res.order.id}:status:completed`,
    );
    expect(completedNotif?.title).toBe("Đơn hàng hoàn tất");
    expect(completedNotif?.href).toBe(`/account/orders/${res.order.id}`);
  });

  it("tạo ownership notification khi khách claim thành công đơn hàng guest", async () => {
    const rawGuestToken = "test_raw_guest_token_12345678901234567890";
    const guestHash = digestOpaqueToken(rawGuestToken);

    const order = await prisma.order.create({
      data: {
        id: "order-claim-test-01",
        code: "ORD-CLAIM-01",
        channel: "online",
        status: "pending",
        fulfillmentStatus: "new",
        fulfillmentType: "delivery",
        total: 150_000,
        subtotal: 150_000,
        clientId: "client-claim-01",
        contactPhone: "0912345678", // Khớp với account phone
        guestAccess: {
          create: {
            tokenHash: guestHash,
            expiresAt: new Date(Date.now() + 86400000),
          },
        },
      },
    });

    const claimRes = await claimGuestOrder({
      customerAccountId: testAccountId,
      guestToken: rawGuestToken,
    });

    expect(claimRes.ok).toBe(true);

    const claimNotif = await prisma.customerNotification.findUnique({
      where: { eventKey: `customer-order:${order.id}:claimed` },
    });

    expect(claimNotif).toBeDefined();
    expect(claimNotif?.accountId).toBe(testAccountId);
    expect(claimNotif?.title).toBe("Đã liên kết đơn hàng");
    expect(claimNotif?.href).toBe(`/account/orders/${order.id}`);
    expect(claimNotif?.body).not.toContain(rawGuestToken);
  });

  it("rollback toàn bộ transaction nếu việc tạo notification gặp lỗi", async () => {
    // Thử tạo một notification với eventKey trùng lặp để kích hoạt lỗi unique constraint
    const order = await prisma.order.create({
      data: {
        id: "order-fail-tx-01",
        code: "ORD-FAIL-01",
        channel: "online",
        status: "pending",
        fulfillmentStatus: "new",
        fulfillmentType: "delivery",
        customerAccountId: testAccountId,
        total: 150_000,
        subtotal: 150_000,
        clientId: "client-fail-tx-01",
      },
    });

    // Tạo sẵn notification cho confirmed
    await prisma.customerNotification.create({
      data: {
        accountId: testAccountId,
        eventKey: `customer-order:${order.id}:status:confirmed`,
        kind: "order_status_confirmed",
        title: "Đơn hàng đã xác nhận",
        body: "Đã xác nhận",
        orderId: order.id,
        href: `/account/orders/${order.id}`,
      },
    });

    // Khi transitionOnlineOrder cố tạo trùng eventKey (hoặc lỗi bên trong tx), transaction phải rollback
    // Giữ nguyên trạng thái cũ "new"
    await expect(
      transitionOnlineOrder(order.id, "confirmed"),
    ).rejects.toThrow();

    const orderAfter = await prisma.order.findUnique({
      where: { id: order.id },
    });
    expect(orderAfter?.fulfillmentStatus).toBe("new");
  });

  it("sanitizeNotificationBody loại bỏ thông tin nhạy cảm (phone, token, nonce, note dài)", () => {
    const raw =
      "Đơn hàng ORD-999 đặt bởi 0912345678 tại 123 Đường CMT8 P1 Q3 token=secret123 nonce=hash999 note=Giao giờ hành chính";
    const sanitized = sanitizeNotificationBody(raw, { orderCode: "ORD-999" });

    expect(sanitized).not.toContain("0912345678");
    expect(sanitized).not.toContain("secret123");
    expect(sanitized).not.toContain("hash999");
    expect(sanitized).not.toContain("123 Đường CMT8");
    expect(sanitized).toContain("ORD-999");
  });

  it("tạo payment notification khi xác nhận thanh toán đơn hàng online", async () => {
    const res = await createOrder({
      clientId: "test-client-cust-payment-01",
      channel: "online",
      customerAccountId: testAccountId,
      lines: [
        {
          productId: testProductId,
          name: "Sản phẩm test",
          unitPrice: 150_000,
          originalPrice: 150_000,
          quantity: 1,
          discount: 0,
          unit: "cái",
          isService: false,
        },
      ],
      payments: [
        {
          method: "transfer",
          amount: 150_000,
        },
      ],
      online: {
        fulfillmentStatus: "new",
        fulfillmentType: "delivery",
        paymentMethod: "bank_transfer",
        contactName: "Nguyễn Văn A",
        contactPhone: "0912345678",
      },
    });

    await markOnlineOrderPaid(res.order.id);

    const notif = await prisma.customerNotification.findUnique({
      where: { eventKey: `customer-order:${res.order.id}:payment:paid` },
    });

    expect(notif).toBeDefined();
    expect(notif?.title).toBe("Thanh toán thành công");
    expect(notif?.accountId).toBe(testAccountId);
  });
});
