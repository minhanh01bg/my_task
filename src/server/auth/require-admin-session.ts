import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, verifySession } from "@/server/auth/session";

export class AdminUnauthorizedError extends Error {
  readonly code = "ADMIN_UNAUTHORIZED";

  constructor(message = "Yêu cầu quyền quản trị") {
    super(message);
    this.name = "AdminUnauthorizedError";
  }
}

function readCookie(cookieHeader: string | null, name: string): string | null {
  const encoded = cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  if (!encoded) return null;
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

export interface RequireAdminSessionOptions {
  request?: Request;
  redirectToLogin?: boolean;
}

export async function resolveAdminSessionToken(
  request?: Request,
): Promise<string | null> {
  if (request) {
    return readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  }
  try {
    const cookieStore = await cookies();
    return cookieStore.get(SESSION_COOKIE)?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Checks whether the current request or server execution context has a valid admin session.
 * Middleware is defense-in-depth; this is the authoritative server-side trust boundary.
 */
export async function hasAdminSession(request?: Request): Promise<boolean> {
  const token = await resolveAdminSessionToken(request);
  return Boolean(token && (await verifySession(token)));
}

/**
 * Asserts that the caller has a valid admin session.
 * Can be used in Server Components, Server Actions, and route handlers.
 *
 * - If redirectToLogin is true and unauthenticated, redirects browser to /admin/login.
 * - If redirectToLogin is false/omitted and unauthenticated, throws AdminUnauthorizedError.
 */
export async function requireAdminSession(
  opts?: RequireAdminSessionOptions | Request,
): Promise<{ authorized: true }> {
  const options: RequireAdminSessionOptions =
    opts && "headers" in opts ? { request: opts } : (opts ?? {});

  const isAuthed = await hasAdminSession(options.request);

  if (!isAuthed) {
    if (options.redirectToLogin) {
      redirect("/admin/login");
    }
    throw new AdminUnauthorizedError();
  }

  return { authorized: true };
}
