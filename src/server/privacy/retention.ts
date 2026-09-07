import { env } from "@/config/env";
import { prisma } from "@/server/db/prisma";

export interface DataInventoryItem {
  field: string;
  category:
    | "order_pii"
    | "financial_audit"
    | "transient_session"
    | "transient_capability"
    | "limiter_telemetry";
  owner: string;
  purpose: string;
  retentionDays: number;
  actionOnExpiry: "anonymize" | "delete" | "retain";
}

export const DATA_INVENTORY: DataInventoryItem[] = [
  {
    field: "Order.contactName, Order.contactPhone, Order.deliveryAddress",
    category: "order_pii",
    owner: "Customer & Online Operations",
    purpose: "Customer contact, order routing and delivery fulfillment",
    retentionDays: 90,
    actionOnExpiry: "anonymize",
  },
  {
    field: "Order.total, Order.code, OrderItem.*, Payment.*, StockMovement.*",
    category: "financial_audit",
    owner: "Store Accounting & Tax Authority",
    purpose:
      "Statutory tax reporting, revenue auditing, and inventory tracking",
    retentionDays: 3650, // 10 years
    actionOnExpiry: "retain",
  },
  {
    field: "CustomerSession.tokenHash, AdminSession.tokenHash",
    category: "transient_session",
    owner: "Authentication & Security",
    purpose: "User authentication, session state and access revocation",
    retentionDays: 30,
    actionOnExpiry: "delete",
  },
  {
    field: "GuestOrderAccess.tokenHash, CheckoutIdempotency.recoveryDigest",
    category: "transient_capability",
    owner: "Online Checkout & Fulfillment",
    purpose:
      "Short-lived capability retrieval and concurrent checkout recovery",
    retentionDays: 7,
    actionOnExpiry: "delete",
  },
  {
    field: "RateLimit.bucketKeys",
    category: "limiter_telemetry",
    owner: "Platform Infrastructure",
    purpose: "DDoS mitigation and brute-force prevention (HMAC pseudonymized)",
    retentionDays: 1,
    actionOnExpiry: "delete",
  },
];

export function getRetentionCutoffDate(
  retentionDays: number,
  now: Date = new Date(),
): Date {
  return new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);
}

export interface RetentionOptions {
  dryRun?: boolean;
  retentionDays?: number;
  batchSize?: number;
  now?: Date;
}

export interface RetentionSummary {
  dryRun: boolean;
  cutoffDate: Date;
  ordersEligible: number;
  ordersAnonymized: number;
  expiredGuestAccessPurged: number;
  expiredIdempotencyPurged: number;
  expiredCustomerSessionsPurged: number;
  expiredAdminSessionsPurged: number;
}

/**
 * Applies privacy retention policies to the Online Store database.
 * Default mode is safe dry-run. Destructive execution requires dryRun: false.
 *
 * CRITICAL PRIVACY & ACCOUNTING INVARIANTS:
 * - Customer PII (name, phone, address, notes) older than retention threshold is anonymized.
 * - Orders marked with `legalHold: true` are strictly exempt from automated modification.
 * - Financial order data (code, total, items, unit prices, line totals, stock movements)
 *   is IMMUTABLY preserved for tax and accounting compliance.
 * - Transient access capabilities (guest tokens, recovery digests, expired sessions)
 *   are purged independently on shorter TTL schedules.
 */
export async function applyOnlineStoreRetention(
  options?: RetentionOptions,
): Promise<RetentionSummary> {
  const dryRun = options?.dryRun ?? true;
  const retentionDays = options?.retentionDays ?? env.DATA_RETENTION_DAYS ?? 90;
  const now = options?.now ?? new Date();
  const batchSize = options?.batchSize ?? 100;
  const cutoffDate = getRetentionCutoffDate(retentionDays, now);

  // 1. Query eligible orders (older than cutoff, not yet anonymized, not under legal hold)
  const eligibleOrderCount = await prisma.order.count({
    where: {
      createdAt: { lt: cutoffDate },
      anonymizedAt: null,
      legalHold: false,
    },
  });

  // Query eligible transient records
  const [
    expiredGuestAccessCount,
    expiredIdempotencyCount,
    expiredCustomerSessionsCount,
    expiredAdminSessionsCount,
  ] = await Promise.all([
    prisma.guestOrderAccess.count({
      where: { expiresAt: { lt: now } },
    }),
    prisma.checkoutIdempotency.count({
      where: { expiresAt: { lt: now } },
    }),
    prisma.customerSession.count({
      where: { expiresAt: { lt: cutoffDate } },
    }),
    prisma.adminSession.count({
      where: { expiresAt: { lt: cutoffDate } },
    }),
  ]);

  if (dryRun) {
    return {
      dryRun: true,
      cutoffDate,
      ordersEligible: eligibleOrderCount,
      ordersAnonymized: 0,
      expiredGuestAccessPurged: expiredGuestAccessCount,
      expiredIdempotencyPurged: expiredIdempotencyCount,
      expiredCustomerSessionsPurged: expiredCustomerSessionsCount,
      expiredAdminSessionsPurged: expiredAdminSessionsCount,
    };
  }

  // 2. Destructive execution: Anonymize orders in bounded batches
  let ordersAnonymized = 0;
  let hasMore = true;

  while (hasMore) {
    const batch = await prisma.order.findMany({
      where: {
        createdAt: { lt: cutoffDate },
        anonymizedAt: null,
        legalHold: false,
      },
      select: { id: true },
      take: batchSize,
    });

    if (batch.length === 0) {
      hasMore = false;
      break;
    }

    const ids = batch.map((o) => o.id);

    const result = await prisma.order.updateMany({
      where: { id: { in: ids }, anonymizedAt: null, legalHold: false },
      data: {
        contactName: "Khách hàng đã ẩn danh",
        contactPhone: null,
        deliveryAddress: null,
        deliveryWard: null,
        deliveryDistrict: null,
        deliveryProvince: null,
        note: null,
        anonymizedAt: now,
      },
    });

    ordersAnonymized += result.count;
    if (batch.length < batchSize) {
      hasMore = false;
    }
  }

  // 3. Purge expired transient sessions & capabilities
  const [purgedGuest, purgedIdemp, purgedCustSessions, purgedAdminSessions] =
    await Promise.all([
      prisma.guestOrderAccess.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      prisma.checkoutIdempotency.deleteMany({
        where: { expiresAt: { lt: now } },
      }),
      prisma.customerSession.deleteMany({
        where: { expiresAt: { lt: cutoffDate } },
      }),
      prisma.adminSession.deleteMany({
        where: { expiresAt: { lt: cutoffDate } },
      }),
    ]);

  return {
    dryRun: false,
    cutoffDate,
    ordersEligible: eligibleOrderCount,
    ordersAnonymized,
    expiredGuestAccessPurged: purgedGuest.count,
    expiredIdempotencyPurged: purgedIdemp.count,
    expiredCustomerSessionsPurged: purgedCustSessions.count,
    expiredAdminSessionsPurged: purgedAdminSessions.count,
  };
}
