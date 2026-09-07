import { prisma } from "@/server/db/prisma";

export interface LogAdminActionOptions {
  identityId?: string;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Records attributable admin mutations without collecting customer PII.
 */
export async function logAdminAction(
  options: LogAdminActionOptions,
): Promise<void> {
  try {
    await prisma.adminAuditEvent.create({
      data: {
        identityId: options.identityId,
        action: options.action,
        entityType: options.entityType,
        entityId: options.entityId,
        metadata: options.metadata ? JSON.stringify(options.metadata) : null,
        ipAddress: options.ipAddress,
      },
    });
  } catch {
    // Non-blocking: audit logging failure should not abort the operational action
  }
}
