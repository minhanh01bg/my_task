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
  "/api/online/wishlist",
  "/api/online/vouchers/validate",
  "/api/customer-auth/register",
  "/api/customer-auth/login",
  "/api/customer-auth/logout",
  "/api/csp-report",
  "/api/storefront/session",
];

export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PAGES.some(
      (path) =>
        pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)),
    ) ||
    PUBLIC_API.includes(pathname) ||
    // GET công khai; POST tự kiểm tra phiên khách hàng trong route handler.
    /^\/api\/online\/products\/[^/]+\/reviews$/.test(pathname)
  );
}
