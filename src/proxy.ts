import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/server/auth/constants";
import { isPublicPath } from "@/lib/auth/public-paths";

export async function proxy(request: NextRequest) {
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
    // Chu quan bi dang xuat giua chung quay lai dung trang admin sau khi
    // dang nhap; /pos giu mac dinh (login-form tu ve /pos).
    if (pathname.startsWith("/admin")) {
      loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export { proxy as middleware };

export const config = {
  matcher: ["/pos/:path*", "/admin/:path*", "/api/:path*"],
};
