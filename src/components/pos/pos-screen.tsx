"use client";

import { useEffect, useMemo, useState } from "react";

import { CartPanel } from "@/components/pos/cart-panel";
import { CashPaymentDialog } from "@/components/pos/cash-payment-dialog";
import { CategoryGrid } from "@/components/pos/category-grid";
import { ProductSearch } from "@/components/pos/product-search";
import { ServiceLineDialog } from "@/components/pos/service-line-dialog";
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";
import { calculateCart } from "@/lib/pricing/calculate";
import { useCartStore } from "@/stores/cart-store";
import type { CatalogResponse } from "@/types/catalog";

interface PosScreenProps {
  catalog: CatalogResponse;
}

interface LastSale {
  code: string;
  total: number;
  received: number;
  change: number;
}

export function PosScreen({ catalog }: PosScreenProps) {
  const lines = useCartStore((state) => state.lines);
  const orderDiscount = useCartStore((state) => state.orderDiscount);
  const addProduct = useCartStore((state) => state.addProduct);
  const clear = useCartStore((state) => state.clear);

  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSale, setLastSale] = useState<LastSale | null>(null);

  const totals = useMemo(
    () => calculateCart(lines, orderDiscount),
    [lines, orderDiscount],
  );

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "F4" && lines.length > 0) {
        event.preventDefault();
        setPaymentOpen(true);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lines.length]);

  async function handleConfirm(received: number) {
    setSubmitting(true);

    const response = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientId: crypto.randomUUID(),
        channel: "pos",
        lines: lines.map((line) => ({
          productId: line.productId,
          name: line.name,
          unitPrice: line.unitPrice,
          originalPrice: line.originalPrice,
          quantity: line.quantity,
          discount: line.discount,
          unit: line.unit,
          isService: line.isService,
        })),
        orderDiscount,
        payments: [{ method: "cash", amount: totals.total }],
      }),
    });

    setSubmitting(false);

    if (!response.ok) {
      window.alert("Lưu đơn thất bại. Thử lại.");
      return;
    }

    const result = (await response.json()) as {
      order: { code: string; total: number };
    };

    setLastSale({
      code: result.order.code,
      total: result.order.total,
      received,
      change: Math.max(0, received - result.order.total),
    });
    setPaymentOpen(false);
    clear();
  }

  return (
    <main className="grid h-dvh grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_420px]">
      <section className="flex min-h-0 flex-col gap-4 overflow-y-auto">
        <ProductSearch products={catalog.products} onSelect={addProduct} />
        <CategoryGrid
          categories={catalog.categories}
          products={catalog.products}
          activeCategoryId={activeCategoryId}
          onCategoryChange={setActiveCategoryId}
          onSelect={addProduct}
        />
      </section>

      <section className="flex min-h-0 flex-col gap-2 rounded-lg border p-4">
        <Button variant="outline" onClick={() => setServiceOpen(true)}>
          + Thêm tiền công
        </Button>
        <CartPanel onCheckout={() => setPaymentOpen(true)} />
      </section>

      <ServiceLineDialog open={serviceOpen} onOpenChange={setServiceOpen} />

      <CashPaymentDialog
        open={paymentOpen && !submitting}
        total={totals.total}
        onCancel={() => setPaymentOpen(false)}
        onConfirm={handleConfirm}
      />

      {lastSale ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-background w-full max-w-md space-y-4 rounded-lg p-8 text-center">
            <p className="text-muted-foreground">Đã lưu đơn {lastSale.code}</p>
            <p className="text-lg">Khách đưa {formatVnd(lastSale.received)}</p>
            <p className="text-muted-foreground text-sm">Tiền thối lại</p>
            <p
              data-testid="last-sale-change"
              className="text-7xl font-bold tabular-nums"
            >
              {formatVnd(lastSale.change)}
            </p>
            <Button
              autoFocus
              className="h-16 w-full text-xl"
              onClick={() => setLastSale(null)}
            >
              Đơn mới
            </Button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
