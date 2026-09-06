import { SESSION_COOKIE, verifySession } from "@/server/auth/session";

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

/** Route-level authorization; middleware is defense-in-depth, not the trust boundary. */
export async function hasAdminSession(request: Request): Promise<boolean> {
  const token = readCookie(request.headers.get("cookie"), SESSION_COOKIE);
  return Boolean(token && (await verifySession(token)));
}
