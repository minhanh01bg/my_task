import { prisma } from "@/server/db/prisma";

export const REVIEW_PRODUCT_ID = "test-review-prod-01";
export const REVIEW_OTHER_PRODUCT_ID = "test-review-prod-02";
export const REVIEW_ACCOUNT_PHONE = "+84900000991";
export const REVIEW_OTHER_PHONE = "+84900000992";

export async function resetReviewFixtures() {
  await prisma.productReview.deleteMany();
  await prisma.order.deleteMany({
    where: { clientId: { startsWith: "test-review-" } },
  });
  await prisma.product.deleteMany({
    where: { id: { in: [REVIEW_PRODUCT_ID, REVIEW_OTHER_PRODUCT_ID] } },
  });
  await prisma.customerAccount.deleteMany({
    where: {
      phoneNormalized: { in: [REVIEW_ACCOUNT_PHONE, REVIEW_OTHER_PHONE] },
    },
  });
  await prisma.adminAuditEvent.deleteMany({
    where: { entityType: "product_review" },
  });
}

export async function seedReviewFixtures() {
  await prisma.product.createMany({
    data: [
      { id: REVIEW_PRODUCT_ID, name: "Cà phê Robusta", price: 90_000 },
      { id: REVIEW_OTHER_PRODUCT_ID, name: "Trà xanh", price: 40_000 },
    ],
  });
  const account = await prisma.customerAccount.create({
    data: {
      phoneNormalized: REVIEW_ACCOUNT_PHONE,
      displayName: "Minh Anh",
      passwordHash: "dummy",
    },
  });
  const other = await prisma.customerAccount.create({
    data: {
      phoneNormalized: REVIEW_OTHER_PHONE,
      displayName: "Thu Trang",
      passwordHash: "dummy",
    },
  });
  return { accountId: account.id, otherAccountId: other.id };
}

export async function seedOrder(options: {
  accountId: string;
  productId: string;
  status?: string;
  fulfillmentStatus?: string | null;
  key: string;
}) {
  return prisma.order.create({
    data: {
      code: `TR-${options.key}`,
      clientId: `test-review-${options.key}`,
      channel: "online",
      status: options.status ?? "pending",
      fulfillmentStatus: options.fulfillmentStatus ?? null,
      customerAccountId: options.accountId,
      subtotal: 90_000,
      total: 90_000,
      items: {
        create: {
          productId: options.productId,
          nameSnapshot: "SP",
          unitPrice: 90_000,
          originalPrice: 90_000,
          quantity: 1,
          lineTotal: 90_000,
        },
      },
    },
  });
}
