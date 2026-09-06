import { digestOpaqueToken } from "@/server/customer-auth/session";
import { prisma } from "@/server/db/prisma";

export const customerOrderSelect = {
  id: true,
  code: true,
  createdAt: true,
  status: true,
  total: true,
  fulfillmentStatus: true,
  fulfillmentType: true,
  paymentMethod: true,
  contactName: true,
  contactPhone: true,
  deliveryAddress: true,
  deliveryWard: true,
  deliveryDistrict: true,
  deliveryProvince: true,
  note: true,
  items: {
    select: {
      id: true,
      nameSnapshot: true,
      quantity: true,
      unit: true,
      unitPrice: true,
      lineTotal: true,
    },
  },
} as const;

export function listCustomerOrders(accountId: string) {
  return prisma.order.findMany({
    where: { customerAccountId: accountId, channel: "online" },
    orderBy: { createdAt: "desc" },
    select: customerOrderSelect,
  });
}

export function findOwnedCustomerOrder(accountId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, customerAccountId: accountId, channel: "online" },
    select: customerOrderSelect,
  });
}

export function findGuestOrder(token: string) {
  return prisma.guestOrderAccess.findFirst({
    where: {
      tokenHash: digestOpaqueToken(token),
      revokedAt: null,
      expiresAt: { gt: new Date() },
    },
    select: { order: { select: customerOrderSelect } },
  });
}
