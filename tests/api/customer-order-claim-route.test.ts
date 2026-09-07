import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { POST } from "@/app/api/customer/orders/claim/route";
import {
  createCustomerSession,
  CUSTOMER_SESSION_COOKIE,
  digestOpaqueToken,
} from "@/server/customer-auth/session";
import { prisma } from "@/server/db/prisma";

const testData = {
  accountId: "claim-test-account-1",
  unverifiedAccountId: "claim-test-account-unverified",
  otherAccountId: "claim-test-account-other",
  orderId: "claim-test-order-1",
  token: "claim-test-valid-token",
};

describe("POST /api/customer/orders/claim", () => {
  let validSessionCookie: string;
  let unverifiedSessionCookie: string;

  beforeAll(async () => {
    // Verified account
    await prisma.customerAccount.create({
      data: {
        id: testData.accountId,
        phoneNormalized: "+84911222333",
        displayName: "Verified User",
        passwordHash: "hash",
        phoneVerifiedAt: new Date(),
      },
    });
    const s1 = await createCustomerSession(testData.accountId);
    validSessionCookie = `${CUSTOMER_SESSION_COOKIE}=${s1.token}`;

    // Unverified account
    await prisma.customerAccount.create({
      data: {
        id: testData.unverifiedAccountId,
        phoneNormalized: "+84911222444",
        displayName: "Unverified User",
        passwordHash: "hash",
        phoneVerifiedAt: null,
      },
    });
    const s2 = await createCustomerSession(testData.unverifiedAccountId);
    unverifiedSessionCookie = `${CUSTOMER_SESSION_COOKIE}=${s2.token}`;

    // Unowned order
    await prisma.order.create({
      data: {
        id: testData.orderId,
        code: "CLAIM-001",
        clientId: "client-claim-001",
        channel: "online",
        contactPhone: "0911222333", // matches +84911222333
        customerAccountId: null,
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
          in: [testData.accountId, testData.unverifiedAccountId],
        },
      },
    });
    await prisma.customerAccount.deleteMany({
      where: {
        id: {
          in: [testData.accountId, testData.unverifiedAccountId],
        },
      },
    });
  });

  it("rejects untrusted/cross-site origin with 403", async () => {
    const req = new Request("http://localhost:3000/api/customer/orders/claim", {
      method: "POST",
      headers: {
        origin: "https://evil.attacker.com",
        "sec-fetch-site": "cross-site",
        "content-type": "application/json",
      },
      body: JSON.stringify({ token: testData.token }),
    });

    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("rejects unauthenticated requests with 401", async () => {
    const req = new Request("http://localhost:3000/api/customer/orders/claim", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
      },
      body: JSON.stringify({ token: testData.token }),
    });

    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("rejects unverified account claim attempts with 404", async () => {
    const req = new Request("http://localhost:3000/api/customer/orders/claim", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
        cookie: unverifiedSessionCookie,
      },
      body: JSON.stringify({ token: testData.token }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("rejects invalid/expired/revoked token with indistinguishable 404", async () => {
    const req = new Request("http://localhost:3000/api/customer/orders/claim", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
        cookie: validSessionCookie,
      },
      body: JSON.stringify({ token: "non-existent-token" }),
    });

    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("atomically claims order and returns 200 with orderId", async () => {
    const req = new Request("http://localhost:3000/api/customer/orders/claim", {
      method: "POST",
      headers: {
        origin: "http://localhost:3000",
        "content-type": "application/json",
        cookie: validSessionCookie,
      },
      body: JSON.stringify({ token: testData.token }),
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.orderId).toBe(testData.orderId);

    // Re-claiming fails with 404
    const reReq = new Request(
      "http://localhost:3000/api/customer/orders/claim",
      {
        method: "POST",
        headers: {
          origin: "http://localhost:3000",
          "content-type": "application/json",
          cookie: validSessionCookie,
        },
        body: JSON.stringify({ token: testData.token }),
      },
    );
    const reRes = await POST(reReq);
    expect(reRes.status).toBe(404);
  });
});
