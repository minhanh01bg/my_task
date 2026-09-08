import { z } from "zod";

export const customerNotificationSchema = z.object({
  id: z.string(),
  accountId: z.string(),
  eventKey: z.string(),
  kind: z.string(),
  title: z.string(),
  body: z.string(),
  orderId: z.string().nullable().optional(),
  href: z.string(),
  createdAt: z.string().or(z.date()),
  readAt: z.string().or(z.date()).nullable().optional(),
});

export type CustomerNotificationDTO = z.infer<
  typeof customerNotificationSchema
>;

export const customerNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: z.string().optional(),
});

export type CustomerNotificationsQuery = z.infer<
  typeof customerNotificationsQuerySchema
>;

export const customerNotificationMarkReadSchema = z.object({
  notificationId: z.string().trim().optional(),
  all: z.boolean().optional(),
});

export type CustomerNotificationMarkReadInput = z.infer<
  typeof customerNotificationMarkReadSchema
>;

export interface CustomerNotificationsResponse {
  items: CustomerNotificationDTO[];
  unreadCount: number;
  nextCursor?: string | null;
}
