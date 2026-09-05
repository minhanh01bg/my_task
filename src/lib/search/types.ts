export interface SearchableProduct {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  unit: string;
  stock: number;
  imageUrl?: string | null;
  categoryId: string | null;
  soldCount: number;
  imageUrl: string | null;
  /** Chuoi da chuan hoa, dung san khi luu san pham. */
  searchText: string;
}
