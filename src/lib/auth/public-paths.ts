const PUBLIC_PAGES = [
  "/",
  "/shop",
  "/checkout",
  "/order-success",
  "/account",
  "/orders/guest",
];
const PUBLIC_API = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/health",
  "/api/online/orders",
  "/api/customer-auth/register",
  "/api/customer-auth/login",
  "/api/customer-auth/logout",
  "/api/csp-report",
];

export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PAGES.some(
      (path) =>
        pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)),
    ) ||
    PUBLIC_API.includes(pathname) ||
    pathname.startsWith("/api/customer/")
  );
}
