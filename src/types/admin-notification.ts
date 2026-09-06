import { z } from "zod";

export const notificationCursorSchema = z
  .object({
    createdAt: z.iso.datetime(),
    id: z.string().min(1).max(64),
  })
  .strict();

export type NotificationCursor = z.infer<typeof notificationCursorSchema>;

export function encodeNotificationCursor(cursor: NotificationCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeNotificationCursor(value: string): NotificationCursor {
  return notificationCursorSchema.parse(
    JSON.parse(Buffer.from(value, "base64url").toString("utf8")),
  );
}

export const notificationListQuerySchema = z
  .object({
    cursor: z.string().max(512).optional(),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export const adminNotificationSchema = z
  .object({
    id: z.string(),
    kind: z.string(),
    title: z.string(),
    body: z.string(),
    entityType: z.string(),
    entityId: z.string(),
    href: z.string().startsWith("/admin/"),
    createdAt: z.iso.datetime(),
    readAt: z.iso.datetime().nullable(),
  })
  .strict();

export const notificationListResponseSchema = z
  .object({
    data: z
      .object({
        items: z.array(adminNotificationSchema),
        nextCursor: z.string().nullable(),
        unreadCount: z.number().int().nonnegative(),
        cutoff: z.iso.datetime(),
      })
      .strict(),
  })
  .strict();

export const notificationReadSchema = z.union([
  z.object({ id: z.string().min(1).max(64) }).strict(),
  z.object({ allBefore: z.iso.datetime() }).strict(),
]);

export type AdminNotificationDto = z.infer<typeof adminNotificationSchema>;
export type NotificationListResponse = z.infer<
  typeof notificationListResponseSchema
>;
