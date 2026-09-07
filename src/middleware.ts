import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/server/auth/constants";
import { isPublicPath } from "@/lib/auth/public-paths";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login" || isPublicPath(pathname)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/customer/")) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ message: "Chưa đăng nhập" }, { status: 401 });
    }

    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/pos/:path*", "/admin/:path*", "/api/:path*"],
};
