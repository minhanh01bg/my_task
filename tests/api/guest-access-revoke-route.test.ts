import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { POST } from "@/app/api/customer/orders/guest-access/revoke/route";
import {
  createCustomerSession,
  CUSTOMER_SESSION_COOKIE,
  digestOpaqueToken,
} from "@/server/customer-auth/session";
import { prisma } from "@/server/db/prisma";

const testData = {
  ownerAccountId: "revoke-owner-account",
  strangerAccountId: "revoke-stranger-account",
  orderId: "revoke-owned-order",
  token: "revoke-test-guest-token",
};

describe("POST /api/customer/orders/guest-access/revoke", () => {
  let ownerCookie: string;
  let strangerCookie: string;

  beforeAll(async () => {
    await prisma.customerAccount.createMany({
      data: [
        {
          id: testData.ownerAccountId,
          phoneNormalized: "+84988777666",
          displayName: "Owner",
          passwordHash: "hash",
          phoneVerifiedAt: new Date(),
        },
        {
          id: testData.strangerAccountId,
          phoneNormalized: "+84988777555",
          displayName: "Stranger",
          passwordHash: "hash",
          phoneVerifiedAt: new Date(),
        },
      ],
    });

    const s1 = await createCustomerSession(testData.ownerAccountId);
    ownerCookie = `${CUSTOMER_SESSION_COOKIE}=${s1.token}`;

    const s2 = await createCustomerSession(testData.strangerAccountId);
    strangerCookie = `${CUSTOMER_SESSION_COOKIE}=${s2.token}`;

    await prisma.order.create({
      data: {
        id: testData.orderId,
        code: "REVOKE-001",
        clientId: "client-revoke-001",
        channel: "online",
        contactPhone: "0988777666",
        customerAccountId: testData.ownerAccountId,
      },
    });

    await prisma.guestOrderAccess.create({
      data: {
        orderId: testData.orderId,
        tokenHash: digestOpaqueToken(testData.token),
        expiresAt: new Date(Date.now() + 86400_000),
      },
    });
  });

  afterAll(async () => {
    await prisma.guestOrderAccess.deleteMany({
      where: { orderId: testData.orderId },
    });
    await prisma.order.deleteMany({
      where: { id: testData.orderId },
    });
    await prisma.customerSession.deleteMany({
      where: {
        accountId: {
          in: [testData.ownerAccountId, testData.strangerAccountId],
        },
      },
    });
    await prisma.customerAccount.deleteMany({
      where: {
        id: { in: [testData.ownerAccountId, testData.strangerAccountId] },
      },
    });
  });

  it("rejects untrusted origin with 403", async () => {
    const req = new Request(
      "http://localhost:3000/api/customer/orders/guest-access/revoke",
      {
        method: "POST",
        headers: {
          origin: "https://evil.attacker.com",
          "sec-fetch-site": "cross-site",
          "content-type": "application/json",
        },
        body: JSON.stringify({ orderId: testData.orderId }),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const req = new Request(
      "http://localhost:3000/api/customer/orders/guest-access/revoke",
      {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
        },
        body: JSON.stringify({ orderId: testData.orderId }),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects non-owner attempts with 404", async () => {
    const req = new Request(
      "http://localhost:3000/api/customer/orders/guest-access/revoke",
      {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          cookie: strangerCookie,
        },
        body: JSON.stringify({ orderId: testData.orderId }),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("allows owner to revoke guest access with 200", async () => {
    const req = new Request(
      "http://localhost:3000/api/customer/orders/guest-access/revoke",
      {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          cookie: ownerCookie,
        },
        body: JSON.stringify({ orderId: testData.orderId }),
      },
    );

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);

    // Verify guest access is now revoked in database
    const access = await prisma.guestOrderAccess.findUnique({
      where: { orderId: testData.orderId },
    });
    expect(access?.revokedAt).not.toBeNull();
  });
});
