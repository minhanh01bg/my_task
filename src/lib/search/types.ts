export interface SearchableProduct {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  unit: string;
  stock: number;
  categoryId: string | null;
  soldCount: number;
  /** Chuoi da chuan hoa, dung san khi luu san pham. */
  searchText: string;
}
