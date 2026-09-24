/** Thu ngan va chu quan dung chung trang /login — mac dinh vao man ban hang. */
export const DEFAULT_POST_LOGIN_PATH = "/pos";

const ADMIN_PATH = /^\/admin(?:[/?#]|$)/;
const PLACEHOLDER_ORIGIN = "http://next.invalid";

/**
 * Chi nhan `?next=` tro ve mot trang /admin cung origin — moi gia tri khac
 * (URL tuyet doi, `//host`, dau `\`, doan `..` ke ca dang ma hoa %2e) deu ve
 * /pos de /login khong thanh cong cu open redirect. Duong dan duoc chuan hoa
 * qua `URL` truoc khi kiem tra, nen ket qua tra ve luon la dang trinh duyet
 * se thuc su dieu huong toi.
 */
export function resolvePostLoginPath(next: string | null | undefined): string {
  if (!next || !ADMIN_PATH.test(next)) return DEFAULT_POST_LOGIN_PATH;
  if (next.includes("\\") || next.includes("//") || /\s/.test(next)) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  let url: URL;
  try {
    url = new URL(next, PLACEHOLDER_ORIGIN);
  } catch {
    return DEFAULT_POST_LOGIN_PATH;
  }

  if (url.origin !== PLACEHOLDER_ORIGIN || !ADMIN_PATH.test(url.pathname)) {
    return DEFAULT_POST_LOGIN_PATH;
  }
  // Sau khi chuan hoa van con doan "." / ".." (vi du ma hoa %2e) → tu choi.
  if (url.pathname.split("/").some((seg) => seg === "." || seg === "..")) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  return `${url.pathname}${url.search}${url.hash}`;
}
