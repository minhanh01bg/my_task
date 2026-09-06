import { describe, expect, it } from "vitest";

import {
  decodeNotificationCursor,
  encodeNotificationCursor,
  notificationListQuerySchema,
  notificationReadSchema,
} from "@/types/admin-notification";

describe("admin notification contract", () => {
  it("round-trip cursor cặp createdAt/id", () => {
    const cursor = { createdAt: "2026-09-06T10:00:00.000Z", id: "abc" };
    expect(decodeNotificationCursor(encodeNotificationCursor(cursor))).toEqual(
      cursor,
    );
  });

  it("giới hạn limit và từ chối query thừa", () => {
    expect(notificationListQuerySchema.safeParse({ limit: "50" }).success).toBe(
      true,
    );
    expect(notificationListQuerySchema.safeParse({ limit: "51" }).success).toBe(
      false,
    );
    expect(
      notificationListQuerySchema.safeParse({ limit: "10", extra: "x" })
        .success,
    ).toBe(false);
  });

  it("chỉ nhận union strict id hoặc allBefore", () => {
    expect(notificationReadSchema.safeParse({ id: "one" }).success).toBe(true);
    expect(
      notificationReadSchema.safeParse({
        allBefore: "2026-09-06T10:00:00.000Z",
      }).success,
    ).toBe(true);
    expect(
      notificationReadSchema.safeParse({
        id: "one",
        allBefore: "2026-09-06T10:00:00.000Z",
      }).success,
    ).toBe(false);
  });
});
