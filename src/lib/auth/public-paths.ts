const PUBLIC_PAGES = ["/", "/shop", "/checkout", "/order-success"];
const PUBLIC_API = ["/api/auth/login", "/api/health", "/api/online/orders"];

export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PAGES.some(
      (path) =>
        pathname === path || (path !== "/" && pathname.startsWith(`${path}/`)),
    ) || PUBLIC_API.includes(pathname)
  );
}
