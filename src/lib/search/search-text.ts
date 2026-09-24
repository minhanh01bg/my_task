import { normalize } from "./normalize";

export interface SearchTextInput {
  name: string;
  aliases?: string | null;
  sku?: string | null;
  categoryName?: string | null;
}

/**
 * Dung chuoi tim kiem cho mot san pham. Goi luc LUU, khong goi luc tim.
 */
export function buildSearchText(input: SearchTextInput): string {
  const parts = [input.name, input.aliases, input.sku, input.categoryName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .map(normalize);

  return parts.join(" ");
}

/**
 * Chuan hoa query nguoi dung go vao de so voi `searchText` da luu
 * (bo dau, viet thuong, gop khoang trang) — cung mot bo chuan hoa voi luc luu.
 */
export function normalizeSearchText(query: string): string {
  return normalize(query);
}
