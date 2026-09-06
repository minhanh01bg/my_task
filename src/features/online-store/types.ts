export interface OnlineProduct {
  id: string;
  name: string;
  price: number;
  unit: string;
  stock: number;
  imageUrl: string | null;
  categoryId: string | null;
  searchText: string;
}

export interface OnlineCategory {
  id: string;
  name: string;
}

export interface OnlineCatalog {
  categories: OnlineCategory[];
  products: OnlineProduct[];
}

export interface OnlineCartLine extends OnlineProduct {
  quantity: number;
}
