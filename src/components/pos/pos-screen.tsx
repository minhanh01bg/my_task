"use client";

import Link from "next/link";
import {
  ArrowClockwise,
  CheckCircle,
  Plus,
  ShoppingBagOpen,
  Storefront,
  Wrench,
} from "@phosphor-icons/react";
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
import { Button } from "@/components/ui/button";
import { formatVnd } from "@/lib/money";
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

interface PosScreenProps {
  catalog: CatalogResponse;
  bankAccount: BankAccount | null;
  storeName: string;
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
  storeName,
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
  const [refreshingCatalog, setRefreshingCatalog] = useState(false);
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

  const refreshCatalog = useCallback(async () => {
    setRefreshingCatalog(true);
    try {
      const response = await fetch("/api/catalog", { cache: "no-store" });
      if (!response.ok) return;
      const fresh = (await response.json()) as CatalogResponse;
      setCatalog(fresh);
      setStale(false);
      await saveCatalog(fresh);
    } finally {
      setRefreshingCatalog(false);
    }
  }, []);

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
    <main className="mx-auto grid min-h-dvh w-full max-w-[1800px] grid-cols-1 gap-4 p-3 sm:p-5 lg:h-dvh lg:grid-cols-[minmax(0,1fr)_430px] lg:gap-5 lg:p-6">
      <section className="flex min-h-0 flex-col gap-4 lg:overflow-y-auto lg:pr-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="bg-accent/15 text-accent-foreground border-accent/20 mb-2 inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold shadow-sm backdrop-blur-sm">
              <Storefront aria-hidden="true" weight="fill" /> {storeName}
            </span>
            <h1 className="font-heading mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
              Hôm nay bán gì đây?
            </h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Tìm hoặc chọn mặt hàng, kiểm tra giỏ rồi thanh toán.
            </p>
          </div>
          <Link
            href="/admin/products"
            className="border-border bg-card text-foreground hover:bg-accent focus-visible:ring-ring inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold transition-colors focus-visible:ring-3 focus-visible:outline-none"
          >
            <Wrench aria-hidden="true" weight="bold" className="size-5" />
            Quản lý cửa hàng
          </Link>
        </div>

        <div
          className="flex flex-wrap items-center gap-3"
          aria-label="Trạng thái hệ thống"
        >
          <SyncIndicator />
          {stale ? (
            <div className="bg-warning/15 text-warning-foreground flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2 text-sm font-semibold">
              <span>Danh mục đã cũ</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="bg-background min-h-11"
                disabled={refreshingCatalog}
                onClick={() => void refreshCatalog()}
              >
                <ArrowClockwise aria-hidden="true" weight="bold" />
                {refreshingCatalog ? "Đang tải…" : "Tải lại hàng hóa"}
              </Button>
            </div>
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

        <div ref={searchRef} className="surface-panel p-3 sm:p-4">
          <ProductSearch products={catalog.products} onSelect={addProduct} />
        </div>

        <div className="surface-panel p-4 sm:p-5">
          <div className="mb-4 flex items-start gap-3">
            <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
              <ShoppingBagOpen
                aria-hidden="true"
                weight="duotone"
                className="size-6"
              />
            </span>
            <div>
              <h2 className="font-heading font-bold">
                Chọn nhanh theo danh mục
              </h2>
              <p className="text-muted-foreground text-sm">
                Dành cho khi bạn không nhớ chính xác tên sản phẩm.
              </p>
            </div>
          </div>
          <CategoryGrid
            categories={catalog.categories}
            products={catalog.products}
            activeCategoryId={activeCategoryId}
            onCategoryChange={setActiveCategoryId}
            onSelect={addProduct}
          />
        </div>
      </section>

      <section className="surface-panel flex min-h-[520px] flex-col gap-3 p-4 lg:min-h-0 lg:overflow-hidden lg:p-5">
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => setServiceOpen(true)}
          >
            <Plus aria-hidden="true" weight="bold" /> Tiền công
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            disabled={lines.length === 0}
            onClick={holdCurrent}
          >
            Giữ đơn <span className="hidden xl:inline">(F8)</span>
          </Button>
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
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sale-success-title"
            className="bg-background w-full max-w-md space-y-4 rounded-3xl p-6 text-center shadow-2xl sm:p-8"
          >
            <div className="bg-primary/10 text-primary mx-auto flex size-14 items-center justify-center rounded-full">
              <CheckCircle
                aria-hidden="true"
                weight="fill"
                className="size-8"
              />
            </div>
            <h2
              id="sale-success-title"
              className="font-heading text-2xl font-bold"
            >
              Thanh toán thành công
            </h2>
            <p className="text-muted-foreground">
              {lastSale.synced
                ? `Đã lưu đơn ${lastSale.code}`
                : "Đã lưu tạm — sẽ đồng bộ khi có mạng"}
            </p>
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
