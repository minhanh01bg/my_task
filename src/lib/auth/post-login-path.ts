/** Thu ngan va chu quan dung chung trang /login — mac dinh vao man ban hang. */
export const DEFAULT_POST_LOGIN_PATH = "/pos";

const ADMIN_PATH = /^\/admin(?:[/?#]|$)/;

/**
 * Chi nhan `?next=` tro ve mot trang /admin cung origin — moi gia tri khac
 * (URL tuyet doi, `//host`, dau `\`, doan `..`) deu ve /pos de /login khong
 * thanh cong cu open redirect.
 */
export function resolvePostLoginPath(next: string | null | undefined): string {
  if (!next || !ADMIN_PATH.test(next)) return DEFAULT_POST_LOGIN_PATH;
  if (next.includes("\\") || next.includes("//")) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  const [path = ""] = next.split(/[?#]/, 1);
  const segments = path.split("/");
  if (segments.some((segment) => segment === ".." || segment === ".")) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  return next;
}
