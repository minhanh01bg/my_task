import { normalize, tokenize } from "./normalize";
import type { SearchableProduct } from "./types";

const DEFAULT_LIMIT = 30;

/** Bac xep hang — so cang NHO cang uu tien. */
const RANK_SKU_EXACT = 0;
const RANK_NAME_PREFIX = 1;
const RANK_WORD_PREFIX = 2;
const RANK_INFIX = 3;
const RANK_NONE = 99;

/**
 * Bac khop cua MOT tu trong chuoi searchText da chuan hoa.
 */
function tokenRank(
  searchText: string,
  normalizedName: string,
  token: string,
): number {
  if (!searchText.includes(token)) return RANK_NONE;
  if (normalizedName.startsWith(token)) return RANK_NAME_PREFIX;
  if (searchText === token || searchText.startsWith(`${token} `)) {
    return RANK_WORD_PREFIX;
  }
  if (searchText.includes(` ${token}`)) return RANK_WORD_PREFIX;
  return RANK_INFIX;
}

/**
 * Tim san pham trong bo nho. Toan bo danh muc nam san trong RAM nen quet
 * tuyen tinh la du nhanh (vai nghin mon < 1ms) va khong can index phuc tap.
 *
 * Quy tac: san pham phai chua TAT CA cac tu trong query moi duoc hien.
 * Xep hang lay bac TE NHAT trong cac tu — mot tu chi khop giua thi ca
 * san pham bi keo xuong bac do.
 */
export function searchProducts(
  products: SearchableProduct[],
  query: string,
  limit: number = DEFAULT_LIMIT,
): SearchableProduct[] {
  const tokens = tokenize(query);
  if (tokens.length === 0) return [];

  const normalizedQuery = tokens.join(" ");
  const scored: Array<{ item: SearchableProduct; rank: number }> = [];

  for (const item of products) {
    const searchText = item.searchText;
    const normalizedName = normalize(item.name);

    if (item.sku && normalize(item.sku) === normalizedQuery) {
      scored.push({ item, rank: RANK_SKU_EXACT });
      continue;
    }

    let worstRank = RANK_SKU_EXACT;
    let matchedAll = true;

    for (const token of tokens) {
      const rank = tokenRank(searchText, normalizedName, token);
      if (rank === RANK_NONE) {
        matchedAll = false;
        break;
      }
      if (rank > worstRank) worstRank = rank;
    }

    if (matchedAll) {
      scored.push({ item, rank: Math.max(worstRank, RANK_NAME_PREFIX) });
    }
  }

  scored.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (a.item.soldCount !== b.item.soldCount) {
      return b.item.soldCount - a.item.soldCount;
    }
    return a.item.name.localeCompare(b.item.name, "vi");
  });

  return scored.slice(0, limit).map((entry) => entry.item);
}
