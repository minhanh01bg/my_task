import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/server/db/prisma";

export * from "@/server/auth/constants";
import {
  ADMIN_SESSION_IDLE_SECONDS,
  ADMIN_SESSION_MAX_AGE_SECONDS,
  ADMIN_SESSION_TOUCH_INTERVAL_MS,
} from "@/server/auth/constants";
export const ADMIN_SESSION_THROTTLE_SECONDS =
  ADMIN_SESSION_TOUCH_INTERVAL_MS / 1000;

export const adminCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: ADMIN_SESSION_MAX_AGE_SECONDS,
};

const PBKDF2_ITERATIONS = 100_000;
const encoder = new TextEncoder();

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(new ArrayBuffer(hex.length / 2));
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function derive(
  password: string,
  salt: Uint8Array<ArrayBuffer>,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256,
  );
  return toHex(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derive(password, salt);
  return `${toHex(salt.buffer)}:${derived}`;
}

export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  const [saltHex, expected] = hash.split(":");
  if (!saltHex || !expected) return false;
  const derived = await derive(password, fromHex(saltHex));
  return safeEqual(derived, expected);
}

export function digestOpaqueToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export interface AdminPrincipal {
  id: string;
  username: string;
  role: string;
  version: number;
}

export interface ResolvedAdminSession {
  session: {
    id: string;
    identityId: string;
    expiresAt: Date;
    idleExpiresAt: Date;
    lastSeenAt: Date;
  };
  identity: AdminPrincipal;
}

/**
 * Ensures a default owner identity exists for store administration.
 */
export async function ensureDefaultAdminIdentity(): Promise<AdminPrincipal> {
  const existing = await prisma.adminIdentity.findUnique({
    where: { username: "admin" },
    select: { id: true, username: true, role: true, version: true },
  });
  if (existing) return existing;

  try {
    return await prisma.adminIdentity.upsert({
      where: { username: "admin" },
      create: {
        username: "admin",
        role: "owner",
        version: 1,
      },
      update: {},
      select: { id: true, username: true, role: true, version: true },
    });
  } catch {
    const fallback = await prisma.adminIdentity.findUnique({
      where: { username: "admin" },
      select: { id: true, username: true, role: true, version: true },
    });
    if (fallback) return fallback;
    throw new Error("Failed to initialize admin identity");
  }
}

/**
 * Creates an attributable, database-backed admin session with dual absolute and idle timeouts.
 */
export async function createAdminSession(identityId?: string) {
  const targetId = identityId ?? (await ensureDefaultAdminIdentity()).id;
  const identity = await prisma.adminIdentity.findUnique({
    where: { id: targetId },
    select: { id: true, version: true, disabledAt: true },
  });
  if (!identity || identity.disabledAt) {
    throw new Error("Admin identity not found or disabled");
  }

  const token = createOpaqueToken();
  const tokenHash = digestOpaqueToken(token);
  const now = Date.now();
  const expiresAt = new Date(now + ADMIN_SESSION_MAX_AGE_SECONDS * 1000);
  const idleExpiresAt = new Date(now + ADMIN_SESSION_IDLE_SECONDS * 1000);

  await prisma.adminSession.create({
    data: {
      identityId: targetId,
      tokenHash,
      identityVersion: identity.version,
      expiresAt,
      idleExpiresAt,
      lastSeenAt: new Date(now),
    },
  });

  return { token, expiresAt, idleExpiresAt };
}

/**
 * Authoritatively resolves an admin session token against the database.
 * Validates absolute lifetime, idle lifetime, revocation state, and identity status.
 */
export async function resolveAdminSession(
  token?: string | null,
): Promise<ResolvedAdminSession | null> {
  if (!token || typeof token !== "string") return null;

  const tokenHash = digestOpaqueToken(token);
  const now = new Date();

  const session = await prisma.adminSession.findFirst({
    where: {
      tokenHash,
      revokedAt: null,
      expiresAt: { gt: now },
      idleExpiresAt: { gt: now },
      identity: {
        disabledAt: null,
      },
    },
    include: {
      identity: {
        select: {
          id: true,
          username: true,
          role: true,
          version: true,
          disabledAt: true,
        },
      },
    },
  });

  if (!session || !session.identity) return null;

  // Identity version check (credential/role invalidation)
  if (session.identityVersion !== session.identity.version) {
    return null;
  }

  // Throttled touch of lastSeenAt & idleExpiresAt
  if (
    now.getTime() - session.lastSeenAt.getTime() >
    ADMIN_SESSION_THROTTLE_SECONDS * 1000
  ) {
    const newIdle = new Date(now.getTime() + ADMIN_SESSION_IDLE_SECONDS * 1000);
    prisma.adminSession
      .update({
        where: { id: session.id },
        data: { lastSeenAt: now, idleExpiresAt: newIdle },
      })
      .catch(() => {});
  }

  return {
    session: {
      id: session.id,
      identityId: session.identityId,
      expiresAt: session.expiresAt,
      idleExpiresAt: session.idleExpiresAt,
      lastSeenAt: session.lastSeenAt,
    },
    identity: {
      id: session.identity.id,
      username: session.identity.username,
      role: session.identity.role,
      version: session.identity.version,
    },
  };
}

/**
 * Boolean check for whether the token represents a valid, active admin session.
 */
export async function verifySession(token: string): Promise<boolean> {
  const resolved = await resolveAdminSession(token);
  return Boolean(resolved);
}

/**
 * Revokes an individual admin session server-side.
 */
export async function revokeAdminSession(token?: string | null): Promise<void> {
  if (!token || typeof token !== "string") return;
  const tokenHash = digestOpaqueToken(token);
  await prisma.adminSession.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Emergency revocation: revokes all active admin sessions for an identity (or all identities globally).
 */
export async function revokeAllAdminSessions(
  identityId?: string,
): Promise<void> {
  const now = new Date();
  if (identityId) {
    await prisma.$transaction([
      prisma.adminSession.updateMany({
        where: { identityId, revokedAt: null },
        data: { revokedAt: now },
      }),
      prisma.adminIdentity.update({
        where: { id: identityId },
        data: { version: { increment: 1 } },
      }),
    ]);
  } else {
    // Global emergency revocation
    await prisma.adminSession.updateMany({
      where: { revokedAt: null },
      data: { revokedAt: now },
    });
    await prisma.adminIdentity.updateMany({
      data: { version: { increment: 1 } },
    });
  }
}
