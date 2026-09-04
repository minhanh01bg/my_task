export interface OrderPayloadLine {
  productId: string | null;
  name: string;
  unitPrice: number;
  originalPrice: number;
  quantity: number;
  discount: number;
  unit: string;
  isService: boolean;
}

export interface OrderPayloadPayment {
  method: "cash" | "transfer" | "debt";
  amount: number;
  receivedAt?: string | null;
  note?: string | null;
}

/** Dung shape ma POST /api/orders nhan. */
export interface OrderPayload {
  clientId: string;
  channel: "pos" | "online";
  lines: OrderPayloadLine[];
  orderDiscount: number;
  payments: OrderPayloadPayment[];
  customerId?: string | null;
  note?: string | null;
}

export interface QueuedOrder {
  clientId: string;
  payload: OrderPayload;
  queuedAt: number;
  attempts: number;
  lastError: string | null;
}

export interface SubmitResult {
  /** true khi server da nhan don; false khi don nam trong hang doi. */
  synced: boolean;
  order: { code: string; total: number } | null;
}
