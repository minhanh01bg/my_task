import { z } from "zod";

/** Cung dang id voi route /shop/products/[id] (cuid; seed/test tu dat). */
export const backInStockProductIdSchema = z
  .string()
  .regex(/^[A-Za-z0-9_-]{1,64}$/);

export const backInStockUpdateSchema = z
  .object({ productId: backInStockProductIdSchema, subscribed: z.boolean() })
  .strict();
export type BackInStockUpdate = z.infer<typeof backInStockUpdateSchema>;

export const backInStockStateSchema = z
  .object({ productId: z.string(), subscribed: z.boolean() })
  .strict();
export type BackInStockState = z.infer<typeof backInStockStateSchema>;

export const BACK_IN_STOCK_ENDPOINT = "/api/customer/back-in-stock";
export const BACK_IN_STOCK_NOTIFICATION_KIND = "back_in_stock";
