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
