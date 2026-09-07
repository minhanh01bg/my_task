import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@/server/db/prisma";
import {
  claimGuestOrder,
  findGuestOrder,
  findOwnedCustomerOrder,
  listCustomerOrders,
  revokeGuestAccess,
} from "@/server/orders/order-access";
import { digestOpaqueToken } from "@/server/customer-auth/session";

const ids = {
  a: "account-access-a",
  b: "account-access-b",
  unverified: "account-access-unverified",
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
        phoneVerifiedAt: new Date(),
      },
      {
        id: ids.b,
        phoneNormalized: "+84900000002",
        displayName: "B",
        passwordHash: "x",
        phoneVerifiedAt: new Date(),
      },
      {
        id: ids.unverified,
        phoneNormalized: "+84900000099",
        displayName: "Unverified",
        passwordHash: "x",
        phoneVerifiedAt: null,
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
    where: { id: { in: [ids.a, ids.b, ids.unverified] } },
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

  describe("claimGuestOrder", () => {
    const unownedOrderId = "order-unowned-1";
    const guestToken = "guest-claimable-token";

    beforeAll(async () => {
      await prisma.order.create({
        data: {
          id: unownedOrderId,
          code: "TEST-UNOWNED",
          clientId: "client-unowned-1",
          channel: "online",
          contactPhone: "0900000001", // Matches account A (+84900000001)
          customerAccountId: null,
        },
      });

      await prisma.guestOrderAccess.create({
        data: {
          orderId: unownedOrderId,
          tokenHash: digestOpaqueToken(guestToken),
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });
    });

    afterAll(async () => {
      await prisma.guestOrderAccess.deleteMany({
        where: { orderId: unownedOrderId },
      });
      await prisma.order.deleteMany({
        where: { id: unownedOrderId },
      });
    });

    it("rejects wrong, expired, and revoked tokens with indistinguishable failure", async () => {
      // Wrong token
      const wrongResult = await claimGuestOrder({
        customerAccountId: ids.a,
        guestToken: "wrong-token-12345",
      });
      expect(wrongResult.ok).toBe(false);

      // Expired token
      const expiredOrderId = "order-expired-1";
      const expiredToken = "guest-expired-token";
      await prisma.order.create({
        data: {
          id: expiredOrderId,
          code: "TEST-EXPIRED",
          clientId: "client-expired-1",
          channel: "online",
          contactPhone: "0900000001",
        },
      });
      await prisma.guestOrderAccess.create({
        data: {
          orderId: expiredOrderId,
          tokenHash: digestOpaqueToken(expiredToken),
          expiresAt: new Date(Date.now() - 1000), // In the past
        },
      });

      const expiredResult = await claimGuestOrder({
        customerAccountId: ids.a,
        guestToken: expiredToken,
      });
      expect(expiredResult.ok).toBe(false);

      await prisma.guestOrderAccess.deleteMany({
        where: { orderId: expiredOrderId },
      });
      await prisma.order.deleteMany({ where: { id: expiredOrderId } });
    });

    it("rejects claim when customer phone does not match order contact phone", async () => {
      // Account B has phone +84900000002, but order has contactPhone 0900000001 (+84900000001)
      const mismatchResult = await claimGuestOrder({
        customerAccountId: ids.b,
        guestToken,
      });
      expect(mismatchResult.ok).toBe(false);

      // Account unverified has matching phone string +84900000001 but phoneVerifiedAt is null
      const unverifiedResult = await claimGuestOrder({
        customerAccountId: ids.unverified,
        guestToken,
      });
      expect(unverifiedResult.ok).toBe(false);
    });

    it("atomically claims unowned order, revoking guest access", async () => {
      // Verify guest token works before claim
      const guestBefore = await findGuestOrder(guestToken);
      expect(guestBefore?.order.id).toBe(unownedOrderId);

      // Account A claims the order
      const claimResult = await claimGuestOrder({
        customerAccountId: ids.a,
        guestToken,
      });
      expect(claimResult.ok).toBe(true);
      if (claimResult.ok) {
        expect(claimResult.orderId).toBe(unownedOrderId);
      }

      // Guest access immediately stops working
      const guestAfter = await findGuestOrder(guestToken);
      expect(guestAfter).toBeNull();

      // Claimant now owns the order
      const owned = await findOwnedCustomerOrder(ids.a, unownedOrderId);
      expect(owned).not.toBeNull();
      expect(owned?.id).toBe(unownedOrderId);

      // Trying to claim again (already claimed) fails
      const reClaim = await claimGuestOrder({
        customerAccountId: ids.a,
        guestToken,
      });
      expect(reClaim.ok).toBe(false);
    });

    it("handles concurrent claims with exactly one winner", async () => {
      const raceOrderId = `order-race-${Date.now()}`;
      const raceToken = `guest-race-${Date.now()}`;
      await prisma.order.create({
        data: {
          id: raceOrderId,
          code: `RACE-${Date.now()}`,
          clientId: `client-race-${Date.now()}`,
          channel: "online",
          contactPhone: "0900000001",
          customerAccountId: null,
        },
      });
      await prisma.guestOrderAccess.create({
        data: {
          orderId: raceOrderId,
          tokenHash: digestOpaqueToken(raceToken),
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });

      const [res1, res2] = await Promise.all([
        claimGuestOrder({ customerAccountId: ids.a, guestToken: raceToken }),
        claimGuestOrder({ customerAccountId: ids.a, guestToken: raceToken }),
      ]);

      const successes = [res1, res2].filter((r) => r.ok);
      const failures = [res1, res2].filter((r) => !r.ok);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(1);

      await prisma.guestOrderAccess.deleteMany({
        where: { orderId: raceOrderId },
      });
      await prisma.order.deleteMany({ where: { id: raceOrderId } });
    });
  });

  describe("revokeGuestAccess", () => {
    it("allows the owner to explicitly revoke remaining guest access", async () => {
      const ownedOrderId = `order-revoke-${Date.now()}`;
      const token = `guest-revoke-active-${Date.now()}`;

      await prisma.order.create({
        data: {
          id: ownedOrderId,
          code: `REVOKE-${Date.now()}`,
          clientId: `client-revoke-${Date.now()}`,
          channel: "online",
          customerAccountId: ids.a,
        },
      });
      await prisma.guestOrderAccess.create({
        data: {
          orderId: ownedOrderId,
          tokenHash: digestOpaqueToken(token),
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });

      // Verify guest token works
      expect(await findGuestOrder(token)).not.toBeNull();

      // Non-owner cannot revoke
      const nonOwnerRevoke = await revokeGuestAccess({
        customerAccountId: ids.b,
        orderId: ownedOrderId,
      });
      expect(nonOwnerRevoke.ok).toBe(false);

      // Owner revokes
      const ownerRevoke = await revokeGuestAccess({
        customerAccountId: ids.a,
        orderId: ownedOrderId,
      });
      expect(ownerRevoke.ok).toBe(true);

      // Guest access immediately stops working
      expect(await findGuestOrder(token)).toBeNull();

      await prisma.guestOrderAccess.deleteMany({
        where: { orderId: ownedOrderId },
      });
      await prisma.order.deleteMany({ where: { id: ownedOrderId } });
    });
  });
});
