"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CartPanel } from "@/components/pos/cart-panel";
import { CategoryGrid } from "@/components/pos/category-grid";
import { HeldOrdersBar } from "@/components/pos/held-orders-bar";
import {
  PaymentDialog,
  type PaymentResult,
} from "@/components/pos/payment-dialog";
import { ProductSearch } from "@/components/pos/product-search";
import { ServiceLineDialog } from "@/components/pos/service-line-dialog";
import { SyncIndicator } from "@/components/pos/sync-indicator";
import { usePosShortcuts } from "@/components/pos/use-pos-shortcuts";
import { calculateCart } from "@/lib/pricing/calculate";
import {
  isCatalogStale,
  loadCatalog,
  saveCatalog,
} from "@/lib/sync/catalog-cache";
import { submitOrder } from "@/lib/sync/submit";
import type { BankAccount } from "@/lib/vietqr/types";
import { useCartStore } from "@/stores/cart-store";
import { useHeldOrdersStore } from "@/stores/held-orders-store";
import type { CatalogResponse } from "@/types/catalog";
import { Money, TouchButton } from "@/components/kit";

interface PosScreenProps {
  catalog: CatalogResponse;
  bankAccount: BankAccount | null;
}

interface LastSale {
  code: string | null;
  total: number;
  received: number;
  change: number;
  synced: boolean;
}

export function PosScreen({
  catalog: initialCatalog,
  bankAccount,
}: PosScreenProps) {
  const lines = useCartStore((state) => state.lines);
  const orderDiscount = useCartStore((state) => state.orderDiscount);
  const addProduct = useCartStore((state) => state.addProduct);
  const clear = useCartStore((state) => state.clear);
  const hold = useHeldOrdersStore((state) => state.hold);

  const [catalog, setCatalog] = useState(initialCatalog);
  const [stale, setStale] = useState(false);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [serviceOpen, setServiceOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [lastSale, setLastSale] = useState<LastSale | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  // Ma dat truoc de QR mang dung ma don. Sinh lai sau moi lan ban xong.
  const [pendingCode, setPendingCode] = useState(
    () => `DH${Date.now().toString().slice(-6)}`,
  );

  const totals = useMemo(
    () => calculateCart(lines, orderDiscount),
    [lines, orderDiscount],
  );

  // Luu danh muc vao IndexedDB de lan sau mat mang van ban duoc.
  useEffect(() => {
    void saveCatalog(initialCatalog);
  }, [initialCatalog]);

  // Mat mang thi Server Component tra ve danh muc rong — dung ban cache.
  useEffect(() => {
    if (initialCatalog.products.length > 0) return;

    void loadCatalog().then((cached) => {
      if (!cached) return;
      setCatalog(cached);
      setStale(isCatalogStale(cached));
    });
  }, [initialCatalog.products.length]);

  const focusSearch = useCallback(() => {
    searchRef.current?.querySelector("input")?.focus();
  }, []);

  const holdCurrent = useCallback(() => {
    if (lines.length === 0) return;
    hold(lines, orderDiscount);
    clear();
    focusSearch();
  }, [lines, orderDiscount, hold, clear, focusSearch]);

  usePosShortcuts({
    onSearch: focusSearch,
    onCheckout: () => {
      if (lines.length > 0) setPaymentOpen(true);
    },
    onHold: holdCurrent,
  });

  async function handleConfirm(result: PaymentResult) {
    setPaymentOpen(false);

    const outcome = await submitOrder({
      clientId: crypto.randomUUID(),
      preferredCode: pendingCode,
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
      payments: result.payments,
      customerId: result.customerId,
    });

    setLastSale({
      code: outcome.order?.code ?? null,
      total: totals.total,
      received: result.received,
      change: Math.max(0, result.received - totals.total),
      synced: outcome.synced,
    });

    setPendingCode(`DH${Date.now().toString().slice(-6)}`);
    clear();
    focusSearch();
  }

  return (
    <main className="grid h-dvh grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_420px]">
      <section className="flex min-h-0 flex-col gap-4 overflow-y-auto">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold">Bán hàng</h1>
          <Link
            href="/admin/products"
            className="text-muted-foreground text-sm hover:underline"
          >
            Quản lý →
          </Link>
        </div>

        <div className="flex items-center gap-3">
          <SyncIndicator />
          {stale ? (
            <span className="rounded-full bg-amber-100 px-4 py-2 text-sm text-amber-900">
              Danh mục đã cũ — nên làm mới khi có mạng
            </span>
          ) : null}
        </div>

        <HeldOrdersBar
          onResume={(order) => {
            useCartStore.setState({
              lines: order.lines,
              orderDiscount: order.orderDiscount,
            });
            focusSearch();
          }}
        />

        <div ref={searchRef}>
          <ProductSearch products={catalog.products} onSelect={addProduct} />
        </div>

        <CategoryGrid
          categories={catalog.categories}
          products={catalog.products}
          activeCategoryId={activeCategoryId}
          onCategoryChange={setActiveCategoryId}
          onSelect={addProduct}
        />
      </section>

      <section className="bg-card ring-foreground/10 flex min-h-0 flex-col gap-2 rounded-xl p-4 ring-1">
        <div className="flex gap-2">
          <TouchButton
            variant="outline"
            className="flex-1"
            onClick={() => setServiceOpen(true)}
          >
            + Tiền công
          </TouchButton>
          <TouchButton
            variant="outline"
            className="flex-1"
            disabled={lines.length === 0}
            onClick={holdCurrent}
          >
            Giữ đơn (F8)
          </TouchButton>
        </div>
        <CartPanel onCheckout={() => setPaymentOpen(true)} />
      </section>

      <ServiceLineDialog open={serviceOpen} onOpenChange={setServiceOpen} />

      <PaymentDialog
        open={paymentOpen}
        total={totals.total}
        orderCode={pendingCode}
        bankAccount={bankAccount}
        onCancel={() => setPaymentOpen(false)}
        onConfirm={handleConfirm}
      />

      {lastSale ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-background w-full max-w-md space-y-4 rounded-lg p-8 text-center">
            <p className="text-muted-foreground">
              {lastSale.synced
                ? `Đã lưu đơn ${lastSale.code}`
                : "Đã lưu tạm — sẽ đồng bộ khi có mạng"}
            </p>
            <p className="text-lg">
              Khách đưa <Money amount={lastSale.received} />
            </p>
            <p className="text-muted-foreground text-sm">Tiền thối lại</p>
            <p
              data-testid="last-sale-change"
              className="text-7xl font-bold tabular-nums"
            >
              <Money
                amount={lastSale.change}
                size="display"
                className="text-7xl"
              />
            </p>
            <TouchButton
              autoFocus
              className="h-16 w-full text-xl"
              onClick={() => setLastSale(null)}
            >
              Đơn mới
            </TouchButton>
          </div>
        </div>
      ) : null}
    </main>
  );
}
