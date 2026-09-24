export interface OnlineProduct {
  id: string;
  name: string;
  /** URL SEO `/shop/p/<slug>`; null với dữ liệu cũ chưa backfill. */
  slug?: string | null;
  price: number;
  unit: string;
  stock: number;
  imageUrl: string | null;
  categoryId: string | null;
  searchText: string;
  soldCount?: number;
  /** Điểm trung bình của đánh giá đã đăng (0 khi chưa có). */
  ratingAvg?: number;
  /** Số đánh giá đã đăng — 0 thì ẩn sao, không hiển thị số liệu giả. */
  ratingCount?: number;
}

export interface OnlineCategory {
  id: string;
  name: string;
  /** Trang danh mục `/shop/c/<slug>`; null thì dùng bộ lọc `?category=`. */
  slug?: string | null;
  productCount?: number;
}

export interface OnlineCatalog {
  categories: OnlineCategory[];
  products: OnlineProduct[];
}

export interface OnlineCartLine extends OnlineProduct {
  quantity: number;
}

export type {
  CartMutationResult,
  CartMutationStatus,
  CatalogFilter,
  CatalogSort,
  PromotionPlacement,
  PublicPromotion,
  PublicStoreProfile,
} from "@/types/storefront";
