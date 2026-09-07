import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { hashCustomerPassword } from "@/server/customer-auth/password";
import { registerCustomerAccountWithOptionalSession } from "@/server/customer-auth/session";
import { prisma } from "@/server/db/prisma";

const testPhone = "0987654321";

describe("Atomic Registration and Phone-Enumeration Policy (Task 15)", () => {
  beforeEach(async () => {
    await prisma.customerSession.deleteMany();
    await prisma.customerAccount.deleteMany({
      where: { phoneNormalized: testPhone },
    });
  });

  afterEach(async () => {
    await prisma.customerSession.deleteMany();
    await prisma.customerAccount.deleteMany({
      where: { phoneNormalized: testPhone },
    });
  });

  it("creates account atomically without session when createSession is false", async () => {
    const hash = await hashCustomerPassword("Password123!");
    const result = await registerCustomerAccountWithOptionalSession({
      phoneNormalized: testPhone,
      displayName: "Người Dùng",
      passwordHash: hash,
      createSession: false,
    });

    expect(result.status).toBe("created");
    expect(result.session).toBeUndefined();

    const account = await prisma.customerAccount.findUnique({
      where: { phoneNormalized: testPhone },
    });
    expect(account).not.toBeNull();
    expect(account?.displayName).toBe("Người Dùng");

    const sessions = await prisma.customerSession.findMany({
      where: { accountId: account?.id },
    });
    expect(sessions.length).toBe(0);
  });

  it("creates account and session atomically when createSession is true", async () => {
    const hash = await hashCustomerPassword("Password123!");
    const result = await registerCustomerAccountWithOptionalSession({
      phoneNormalized: testPhone,
      displayName: "Người Dùng Session",
      passwordHash: hash,
      createSession: true,
    });

    expect(result.status).toBe("created");
    expect(result.session).toBeDefined();
    expect(result.session?.token).toBeTruthy();

    const account = await prisma.customerAccount.findUnique({
      where: { phoneNormalized: testPhone },
    });
    expect(account).not.toBeNull();

    const sessions = await prisma.customerSession.findMany({
      where: { accountId: account?.id },
    });
    expect(sessions.length).toBe(1);
  });

  it("rolls back account creation if session creation fails during transaction", async () => {
    const hash = await hashCustomerPassword("Password123!");

    // Attempt registration where session creation fails
    await expect(
      prisma.$transaction(async (tx) => {
        await tx.customerAccount.create({
          data: {
            phoneNormalized: testPhone,
            displayName: "Sẽ Bị Rollback",
            passwordHash: hash,
          },
        });
        throw new Error("Simulated session storage error");
      }),
    ).rejects.toThrow("Simulated session storage error");

    // Verify account was NOT persisted due to transaction rollback
    const account = await prisma.customerAccount.findUnique({
      where: { phoneNormalized: testPhone },
    });
    expect(account).toBeNull();
  });

  it("handles concurrent registrations safely without 500 error or duplicate accounts", async () => {
    const hash = await hashCustomerPassword("Password123!");

    const concurrentAttempts = Array.from({ length: 5 }, (_, i) =>
      registerCustomerAccountWithOptionalSession({
        phoneNormalized: testPhone,
        displayName: `User Concurrent ${i}`,
        passwordHash: hash,
        createSession: false,
      }),
    );

    const results = await Promise.all(concurrentAttempts);

    // None should throw
    expect(results.length).toBe(5);

    // Exactly 1 should have status "created" and others "exists"
    const createdCount = results.filter((r) => r.status === "created").length;
    const existsCount = results.filter((r) => r.status === "exists").length;

    expect(createdCount).toBe(1);
    expect(existsCount).toBe(4);

    // Only 1 record in database
    const accounts = await prisma.customerAccount.findMany({
      where: { phoneNormalized: testPhone },
    });
    expect(accounts.length).toBe(1);
  });

  it("returns status 'exists' on duplicate phone without throwing", async () => {
    const hash = await hashCustomerPassword("Password123!");

    const first = await registerCustomerAccountWithOptionalSession({
      phoneNormalized: testPhone,
      displayName: "Lần 1",
      passwordHash: hash,
    });
    expect(first.status).toBe("created");

    const second = await registerCustomerAccountWithOptionalSession({
      phoneNormalized: testPhone,
      displayName: "Lần 2",
      passwordHash: hash,
    });
    expect(second.status).toBe("exists");
  });
});
