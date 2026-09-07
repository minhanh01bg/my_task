import { createHash, randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Prisma } from "@prisma/client";

import { prisma } from "@/server/db/prisma";

export const CUSTOMER_SESSION_COOKIE = "customer_session";
export const CUSTOMER_SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function digestOpaqueToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString("base64url");
}

export const customerCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: CUSTOMER_SESSION_MAX_AGE_SECONDS,
};

export async function createCustomerSession(accountId: string) {
  const token = createOpaqueToken();
  const expiresAt = new Date(
    Date.now() + CUSTOMER_SESSION_MAX_AGE_SECONDS * 1000,
  );
  await prisma.$transaction([
    prisma.customerSession.updateMany({
      where: { accountId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
    prisma.customerSession.create({
      data: { accountId, tokenHash: digestOpaqueToken(token), expiresAt },
    }),
  ]);
  return { token, expiresAt };
}

export interface RegisterCustomerAccountOptions {
  phoneNormalized: string;
  displayName: string;
  passwordHash: string;
  createSession?: boolean;
}

export interface RegisterCustomerAccountResult {
  status: "created" | "exists";
  accountId?: string;
  session?: {
    token: string;
    expiresAt: Date;
  };
}

/**
 * Atomically registers a customer account and optionally creates an initial session.
 * Handles duplicate phone number conflicts (P2002) without throwing or creating duplicate rows.
 */
export async function registerCustomerAccountWithOptionalSession(
  params: RegisterCustomerAccountOptions,
): Promise<RegisterCustomerAccountResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const account = await tx.customerAccount.create({
        data: {
          phoneNormalized: params.phoneNormalized,
          displayName: params.displayName,
          passwordHash: params.passwordHash,
        },
        select: { id: true },
      });

      if (params.createSession) {
        const token = createOpaqueToken();
        const expiresAt = new Date(
          Date.now() + CUSTOMER_SESSION_MAX_AGE_SECONDS * 1000,
        );
        await tx.customerSession.create({
          data: {
            accountId: account.id,
            tokenHash: digestOpaqueToken(token),
            expiresAt,
          },
        });
        return {
          status: "created" as const,
          accountId: account.id,
          session: { token, expiresAt },
        };
      }

      return {
        status: "created" as const,
        accountId: account.id,
      };
    });
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return { status: "exists" as const };
    }
    throw err;
  }
}

export async function resolveCustomerSessionToken(token?: string | null) {
  if (!token) return null;
  const now = new Date();
  return prisma.customerSession.findFirst({
    where: {
      tokenHash: digestOpaqueToken(token),
      revokedAt: null,
      expiresAt: { gt: now },
      account: { disabledAt: null },
    },
    select: {
      id: true,
      accountId: true,
      account: {
        select: {
          displayName: true,
          phoneNormalized: true,
          phoneVerifiedAt: true,
        },
      },
    },
  });
}

export async function getOptionalCustomerSession() {
  const token = (await cookies()).get(CUSTOMER_SESSION_COOKIE)?.value;
  return resolveCustomerSessionToken(token);
}

export async function requireCustomerSession() {
  const session = await getOptionalCustomerSession();
  if (!session) redirect("/account/login");
  return session;
}

export async function revokeCustomerSession(token?: string | null) {
  if (!token) return;
  await prisma.customerSession.updateMany({
    where: { tokenHash: digestOpaqueToken(token), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
