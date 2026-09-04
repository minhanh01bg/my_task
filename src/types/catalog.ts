import type { SearchableProduct } from "@/lib/search/types";

export interface CatalogCategory {
  id: string;
  name: string;
  sortOrder: number;
}

export interface CatalogResponse {
  categories: CatalogCategory[];
  products: SearchableProduct[];
  fetchedAt: string;
}
