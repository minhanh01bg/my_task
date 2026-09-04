/**
 * Chuan hoa chuoi de tim kiem: bo dau tieng Viet, viet thuong, gop khoang trang.
 * Chay mot lan luc luu san pham (searchText) va moi lan go query.
 */

const COMBINING_MARKS = /[̀-ͯ]/g;
const WHITESPACE = /\s+/g;

export function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(WHITESPACE, " ")
    .trim();
}

export function tokenize(query: string): string[] {
  const normalized = normalize(query);
  if (normalized.length === 0) return [];
  return normalized.split(" ");
}
