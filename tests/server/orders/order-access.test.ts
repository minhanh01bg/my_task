import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import {
  findGuestOrder,
  findOwnedCustomerOrder,
  listCustomerOrders,
} from "@/server/orders/order-access";
import { digestOpaqueToken } from "@/server/customer-auth/session";

const ids = {
  a: "account-access-a",
  b: "account-access-b",
  oa: "order-access-a",
  ob: "order-access-b",
};
beforeAll(async () => {
  await prisma.customerAccount.createMany({
    data: [
      {
        id: ids.a,
        phoneNormalized: "+84900000001",
        displayName: "A",
        passwordHash: "x",
      },
      {
        id: ids.b,
        phoneNormalized: "+84900000002",
        displayName: "B",
        passwordHash: "x",
      },
    ],
  });
  for (const [id, accountId, code, clientId] of [
    [ids.oa, ids.a, "TEST-A", "client-access-a"],
    [ids.ob, ids.b, "TEST-B", "client-access-b"],
  ] as const)
    await prisma.order.create({
      data: {
        id,
        code,
        clientId,
        channel: "online",
        customerAccountId: accountId,
      },
    });
});
afterAll(async () => {
  await prisma.guestOrderAccess.deleteMany({
    where: { orderId: { in: [ids.oa, ids.ob] } },
  });
  await prisma.order.deleteMany({ where: { id: { in: [ids.oa, ids.ob] } } });
  await prisma.customerAccount.deleteMany({
    where: { id: { in: [ids.a, ids.b] } },
  });
});
describe("order ownership", () => {
  it("scope history và detail bằng predicate account", async () => {
    expect((await listCustomerOrders(ids.a)).map((o) => o.id)).toEqual([
      ids.oa,
    ]);
    expect(await findOwnedCustomerOrder(ids.a, ids.ob)).toBeNull();
  });
  it("guest token expiry/revoke và code không cấp quyền", async () => {
    const token = "guest-test-token";
    await prisma.guestOrderAccess.create({
      data: {
        orderId: ids.oa,
        tokenHash: digestOpaqueToken(token),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    expect((await findGuestOrder(token))?.order.id).toBe(ids.oa);
    expect(await findGuestOrder("TEST-A")).toBeNull();
    await prisma.guestOrderAccess.update({
      where: { orderId: ids.oa },
      data: { revokedAt: new Date() },
    });
    expect(await findGuestOrder(token)).toBeNull();
  });
});
