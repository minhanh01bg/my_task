import type { Prisma } from "@prisma/client";

type TransactionClient = Prisma.TransactionClient;

export interface CreateCustomerNotificationInput {
  accountId: string;
  eventKey: string;
  kind: string;
  title: string;
  body: string;
  orderId?: string | null;
  href: string;
}

const STATUS_COPY: Record<string, { title: string; bodyTemplate: string }> = {
  confirmed: {
    title: "Đơn hàng đã xác nhận",
    bodyTemplate: "Đơn hàng #{code} đã được cửa hàng xác nhận.",
  },
  preparing: {
    title: "Đang chuẩn bị hàng",
    bodyTemplate: "Cửa hàng đang đóng gói đơn hàng #{code}.",
  },
  ready: {
    title: "Đơn hàng đã sẵn sàng",
    bodyTemplate:
      "Đơn hàng #{code} đã sẵn sàng để giao hoặc nhận tại cửa hàng.",
  },
  completed: {
    title: "Đơn hàng hoàn tất",
    bodyTemplate: "Đơn hàng #{code} đã hoàn tất thành công.",
  },
  cancelled: {
    title: "Đơn hàng đã hủy",
    bodyTemplate: "Đơn hàng #{code} đã được hủy.",
  },
};

/**
 * Sanitizes notification body to guarantee it never leaks sensitive fields
 * such as full phone numbers, access tokens, nonces, or long notes.
 */
export function sanitizeNotificationBody(
  raw: string,
  context?: { orderCode?: string },
): string {
  let cleaned = raw;

  // Remove phone numbers (+84... or 0[3|5|7|8|9]...)
  cleaned = cleaned.replace(/(?:\+84|0)[35789]\d{8}/g, "[SĐT]");
  cleaned = cleaned.replace(/(?:\+84|0)\d{9,10}/g, "[SĐT]");

  // Remove tokens and nonces
  cleaned = cleaned.replace(/(?:token|nonce)=[^\s,;]+/gi, "");

  // Remove full street address patterns
  cleaned = cleaned.replace(
    /(?:tại|ở|địa chỉ:?)\s+\d+[^,;.\n]+(?:đường|phố|phường|quận|tp|tỉnh)[^,;.\n]*/gi,
    "",
  );

  // Remove trailing notes if prefixed
  cleaned = cleaned.replace(/note=[^\n]+/gi, "");

  cleaned = cleaned.replace(/\s+/g, " ").trim();

  if (context?.orderCode && !cleaned.includes(context.orderCode)) {
    cleaned = `Đơn hàng #${context.orderCode}: ${cleaned}`;
  }

  return cleaned.slice(0, 500);
}

export async function createCustomerNotification(
  tx: TransactionClient,
  input: CreateCustomerNotificationInput,
) {
  const sanitizedBody = sanitizeNotificationBody(input.body);

  return tx.customerNotification.create({
    data: {
      accountId: input.accountId,
      eventKey: input.eventKey,
      kind: input.kind,
      title: input.title.trim().slice(0, 200),
      body: sanitizedBody,
      orderId: input.orderId ?? null,
      href: input.href,
    },
  });
}

export async function createCustomerOrderCreatedNotification(
  tx: TransactionClient,
  order: { id: string; code: string; customerAccountId?: string | null },
) {
  if (!order.customerAccountId) return null;

  return createCustomerNotification(tx, {
    accountId: order.customerAccountId,
    eventKey: `customer-order:${order.id}:created`,
    kind: "order_created",
    title: "Đặt hàng thành công",
    body: `Đơn hàng #${order.code} đã được tiếp nhận.`,
    orderId: order.id,
    href: `/account/orders/${encodeURIComponent(order.id)}`,
  });
}

export async function createCustomerOrderStatusNotification(
  tx: TransactionClient,
  order: { id: string; code: string; customerAccountId?: string | null },
  nextStatus: string,
) {
  if (!order.customerAccountId) return null;

  const copy = STATUS_COPY[nextStatus];
  if (!copy) return null;

  return createCustomerNotification(tx, {
    accountId: order.customerAccountId,
    eventKey: `customer-order:${order.id}:status:${nextStatus}`,
    kind: `order_status_${nextStatus}`,
    title: copy.title,
    body: copy.bodyTemplate.replace("{code}", order.code),
    orderId: order.id,
    href: `/account/orders/${encodeURIComponent(order.id)}`,
  });
}

export async function createCustomerOrderClaimedNotification(
  tx: TransactionClient,
  order: { id: string; code: string },
  accountId: string,
) {
  return createCustomerNotification(tx, {
    accountId,
    eventKey: `customer-order:${order.id}:claimed`,
    kind: "order_claimed",
    title: "Đã liên kết đơn hàng",
    body: `Đơn hàng #${order.code} đã được liên kết vào tài khoản của bạn.`,
    orderId: order.id,
    href: `/account/orders/${encodeURIComponent(order.id)}`,
  });
}

export async function createCustomerOrderPaymentNotification(
  tx: TransactionClient,
  order: { id: string; code: string; customerAccountId?: string | null },
) {
  if (!order.customerAccountId) return null;

  return createCustomerNotification(tx, {
    accountId: order.customerAccountId,
    eventKey: `customer-order:${order.id}:payment:paid`,
    kind: "order_payment_paid",
    title: "Thanh toán thành công",
    body: `Đơn hàng #${order.code} đã được xác nhận thanh toán.`,
    orderId: order.id,
    href: `/account/orders/${encodeURIComponent(order.id)}`,
  });
}
