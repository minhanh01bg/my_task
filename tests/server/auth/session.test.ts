import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  createAdminSession,
  ensureDefaultAdminIdentity,
  hashPassword,
  resolveAdminSession,
  revokeAdminSession,
  revokeAllAdminSessions,
  verifyPassword,
  verifySession,
} from "@/server/auth/session";
import { prisma } from "@/server/db/prisma";

describe("Admin Password Hashing", () => {
  it("confirms correct password", async () => {
    const hash = await hashPassword("matkhau-cua-hang");
    expect(await verifyPassword("matkhau-cua-hang", hash)).toBe(true);
  });

  it("rejects wrong password", async () => {
    const hash = await hashPassword("matkhau-cua-hang");
    expect(await verifyPassword("sai-roi", hash)).toBe(false);
  });

  it("produces different hashes due to salt", async () => {
    const a = await hashPassword("x");
    const b = await hashPassword("x");
    expect(a).not.toBe(b);
  });

  it("rejects empty hash", async () => {
    expect(await verifyPassword("bat ky", "")).toBe(false);
  });
});

describe("Revocable Identity-Bearing Admin Sessions (Task 16)", () => {
  let testIdentityId: string;

  beforeEach(async () => {
    await prisma.adminSession.deleteMany();
    await prisma.adminAuditEvent.deleteMany();
    await prisma.adminIdentity.deleteMany();

    const identity = await prisma.adminIdentity.create({
      data: {
        username: "test-admin",
        role: "owner",
        version: 1,
      },
    });
    testIdentityId = identity.id;
  });

  afterEach(async () => {
    await prisma.adminSession.deleteMany();
    await prisma.adminAuditEvent.deleteMany();
    await prisma.adminIdentity.deleteMany();
  });

  it("creates a session storing only opaque digest in database", async () => {
    const { token, expiresAt, idleExpiresAt } =
      await createAdminSession(testIdentityId);

    expect(token).toBeTruthy();
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(idleExpiresAt.getTime()).toBeGreaterThan(Date.now());

    // Token itself must NEVER be stored in the database in plaintext
    const dbSession = await prisma.adminSession.findFirst({
      where: { identityId: testIdentityId },
    });
    expect(dbSession).not.toBeNull();
    expect(dbSession?.tokenHash).not.toBe(token);
    expect(dbSession?.tokenHash.length).toBe(64); // SHA-256 hex
  });

  it("resolves valid session with identity and role attributes", async () => {
    const { token } = await createAdminSession(testIdentityId);
    const resolved = await resolveAdminSession(token);

    expect(resolved).not.toBeNull();
    expect(resolved?.identity.id).toBe(testIdentityId);
    expect(resolved?.identity.username).toBe("test-admin");
    expect(resolved?.identity.role).toBe("owner");
    expect(await verifySession(token)).toBe(true);
  });

  it("rejects expired session (absolute lifetime exceeded)", async () => {
    const { token } = await createAdminSession(testIdentityId);

    // Force expire absolute
    await prisma.adminSession.updateMany({
      where: { identityId: testIdentityId },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const resolved = await resolveAdminSession(token);
    expect(resolved).toBeNull();
    expect(await verifySession(token)).toBe(false);
  });

  it("rejects idle-expired session", async () => {
    const { token } = await createAdminSession(testIdentityId);

    // Force expire idle
    await prisma.adminSession.updateMany({
      where: { identityId: testIdentityId },
      data: { idleExpiresAt: new Date(Date.now() - 1000) },
    });

    const resolved = await resolveAdminSession(token);
    expect(resolved).toBeNull();
    expect(await verifySession(token)).toBe(false);
  });

  it("rejects revoked session", async () => {
    const { token } = await createAdminSession(testIdentityId);
    await revokeAdminSession(token);

    const resolved = await resolveAdminSession(token);
    expect(resolved).toBeNull();
    expect(await verifySession(token)).toBe(false);
  });

  it("rejects session if admin identity is disabled", async () => {
    const { token } = await createAdminSession(testIdentityId);

    await prisma.adminIdentity.update({
      where: { id: testIdentityId },
      data: { disabledAt: new Date() },
    });

    const resolved = await resolveAdminSession(token);
    expect(resolved).toBeNull();
    expect(await verifySession(token)).toBe(false);
  });

  it("rejects session if identity version was incremented (credential/role rotation)", async () => {
    const { token } = await createAdminSession(testIdentityId);

    // Bump identity version
    await prisma.adminIdentity.update({
      where: { id: testIdentityId },
      data: { version: { increment: 1 } },
    });

    const resolved = await resolveAdminSession(token);
    expect(resolved).toBeNull();
    expect(await verifySession(token)).toBe(false);
  });

  it("revokes single session without affecting other sessions of same identity", async () => {
    const session1 = await createAdminSession(testIdentityId);
    const session2 = await createAdminSession(testIdentityId);

    await revokeAdminSession(session1.token);

    expect(await verifySession(session1.token)).toBe(false);
    expect(await verifySession(session2.token)).toBe(true);
  });

  it("revokes all sessions for identity during emergency revocation", async () => {
    const session1 = await createAdminSession(testIdentityId);
    const session2 = await createAdminSession(testIdentityId);

    await revokeAllAdminSessions(testIdentityId);

    expect(await verifySession(session1.token)).toBe(false);
    expect(await verifySession(session2.token)).toBe(false);
  });

  it("rejects legacy stateless HMAC tokens and random strings", async () => {
    const legacyToken = `${Date.now()}.some-fake-signature`;
    expect(await verifySession(legacyToken)).toBe(false);
    expect(await verifySession("garbage-token")).toBe(false);
    expect(await verifySession("")).toBe(false);
  });

  it("ensures default admin identity is created idempotently", async () => {
    const identity1 = await ensureDefaultAdminIdentity();
    expect(identity1).toBeDefined();
    expect(identity1.role).toBe("owner");

    const identity2 = await ensureDefaultAdminIdentity();
    expect(identity2.id).toBe(identity1.id);
  });
});
