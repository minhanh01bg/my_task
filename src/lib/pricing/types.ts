export interface CartLine {
  /** Id cua dong trong gio (khong phai id san pham). */
  id: string;
  /** null voi dong dich vu — khong gan vao san pham nao. */
  productId: string | null;
  name: string;
  /** Gia thuc te ban ra, co the da bi de len gia niem yet. */
  unitPrice: number;
  /** Gia niem yet luc them vao gio — luu de tra lai sau nay. */
  originalPrice: number;
  quantity: number;
  /** Giam gia rieng cho dong nay, tinh bang VND. */
  discount: number;
  unit: string;
  /** Dong dich vu (tien cong) — khong tru ton kho. */
  isService: boolean;
}

export interface CalculatedLine extends CartLine {
  lineTotal: number;
}

export interface CartTotals {
  lines: CalculatedLine[];
  subtotal: number;
  discount: number;
  total: number;
}
