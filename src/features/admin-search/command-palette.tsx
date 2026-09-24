"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
  type ReactNode,
  type RefObject,
} from "react";
import {
  MagnifyingGlass,
  Package,
  Receipt,
  User,
  X,
} from "@phosphor-icons/react";

import { EmptyState, Money, Skeleton } from "@/components/kit";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { AdminSearchResults } from "@/server/admin/search";

export const ADMIN_SEARCH_DEBOUNCE_MS = 200;

interface PaletteItem {
  key: string;
  href: string;
  title: string;
  subtitle?: string;
  amount?: number;
}

interface PaletteGroup {
  id: "products" | "orders" | "customers";
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: "true" }>;
  items: PaletteItem[];
}

function toGroups(results: AdminSearchResults): PaletteGroup[] {
  const groups: PaletteGroup[] = [
    {
      id: "products",
      label: "Sản phẩm",
      icon: Package,
      items: results.products.map((product) => ({
        key: `product-${product.id}`,
        href: product.href,
        title: product.name,
        subtitle: product.sku ? `SKU ${product.sku}` : undefined,
      })),
    },
    {
      id: "orders",
      label: "Đơn hàng",
      icon: Receipt,
      items: results.orders.map((order) => ({
        key: `order-${order.id}`,
        href: order.href,
        title: order.code,
        subtitle: order.customerName ?? "Khách lẻ",
        amount: order.total,
      })),
    },
    {
      id: "customers",
      label: "Khách hàng",
      icon: User,
      items: results.customers.map((customer) => ({
        key: `customer-${customer.id}`,
        href: customer.href,
        title: customer.displayName,
        subtitle: customer.phone,
      })),
    },
  ];
  return groups.filter((group) => group.items.length > 0);
}

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Hop thoai Ctrl/Cmd+K: tim san pham, don, khach roi nhay thang toi trang. */
export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <Dialog open={open} onOpenChange={(next) => onOpenChange(next)}>
      <DialogContent
        showCloseButton={false}
        initialFocus={inputRef}
        className="top-[12dvh] translate-y-0 gap-0 overflow-hidden p-0 sm:max-w-xl"
      >
        <DialogTitle className="sr-only">Tìm kiếm nhanh</DialogTitle>
        <DialogDescription className="sr-only">
          Tìm sản phẩm, đơn hàng hoặc khách hàng. Dùng phím mũi tên để chọn,
          Enter để mở, Esc để đóng.
        </DialogDescription>
        {/* Popup bi go khoi DOM khi dong nen state ben trong tu reset. */}
        <CommandPaletteBody
          inputRef={inputRef}
          onNavigate={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}

interface CommandPaletteBodyProps {
  inputRef: RefObject<HTMLInputElement | null>;
  onNavigate: () => void;
}

function CommandPaletteBody({ inputRef, onNavigate }: CommandPaletteBodyProps) {
  const router = useRouter();
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const [query, setQuery] = useState("");
  const [lastResult, setLastResult] = useState<{
    query: string;
    data: AdminSearchResults;
  } | null>(null);
  const [errorQuery, setErrorQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const trimmed = query.trim();

  useEffect(() => {
    if (!trimmed) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: trimmed });
      fetch(`/api/admin/search?${params}`, {
        signal: controller.signal,
        headers: { accept: "application/json" },
      })
        .then(async (response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const body = (await response.json()) as { data: AdminSearchResults };
          if (controller.signal.aborted) return;
          setLastResult({ query: trimmed, data: body.data });
          setErrorQuery(null);
          setActiveIndex(0);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setErrorQuery(trimmed);
        });
    }, ADMIN_SEARCH_DEBOUNCE_MS);

    // Go tiep hoac dong palette: huy hen gio va request dang bay.
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed]);

  const isError = Boolean(trimmed) && errorQuery === trimmed;
  const isFresh = lastResult?.query === trimmed;
  const loading = Boolean(trimmed) && !isFresh && !isError;
  // Dang tai query moi thi van giu ket qua cu (lam mo) thay vi nhay skeleton.
  const shown = trimmed && !isError ? lastResult?.data : undefined;
  const groups = shown ? toGroups(shown) : [];
  const options = groups.flatMap((group) => group.items);
  const active = options.length
    ? Math.min(activeIndex, options.length - 1)
    : -1;
  const optionId = (index: number) => `${baseId}-option-${index}`;
  const activeId = active >= 0 ? optionId(active) : undefined;

  useEffect(() => {
    if (!activeId) return;
    document.getElementById(activeId)?.scrollIntoView?.({ block: "nearest" });
  }, [activeId]);

  function navigate(item: PaletteItem) {
    onNavigate();
    router.push(item.href);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Bo go tieng Viet (Telex/VNI qua IME) dung Enter/mui ten luc dang ghep chu.
    if (event.nativeEvent.isComposing || options.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((active + 1) % options.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((active - 1 + options.length) % options.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      navigate(options[active]);
    }
  }

  let flatIndex = 0;

  return (
    <div className="flex max-h-[min(70dvh,560px)] flex-col">
      <div className="flex items-center gap-2 border-b px-4">
        <MagnifyingGlass
          aria-hidden="true"
          className="text-muted-foreground size-5 shrink-0"
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label="Tìm sản phẩm, đơn hàng, khách hàng"
          aria-autocomplete="list"
          aria-expanded={options.length > 0}
          aria-controls={listboxId}
          aria-activedescendant={activeId}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="go"
          placeholder="Tìm sản phẩm, mã đơn, số điện thoại…"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className="placeholder:text-muted-foreground h-14 min-w-0 flex-1 bg-transparent text-base outline-none"
        />
        <DialogClose
          aria-label="Đóng tìm kiếm"
          className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring flex size-9 shrink-0 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:outline-none"
        >
          <X aria-hidden="true" className="size-4" />
        </DialogClose>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div
          role="listbox"
          id={listboxId}
          aria-label="Kết quả tìm kiếm"
          aria-busy={loading}
          className={cn(
            "transition-opacity",
            loading && options.length > 0 && "opacity-60",
          )}
        >
          {groups.map((group) => {
            const headingId = `${baseId}-group-${group.id}`;
            const Icon = group.icon;
            return (
              <div
                key={group.id}
                role="group"
                aria-labelledby={headingId}
                className="mb-2 last:mb-0"
              >
                <div
                  id={headingId}
                  role="presentation"
                  className="text-muted-foreground px-2 pt-2 pb-1 text-xs font-semibold tracking-wide uppercase"
                >
                  {group.label}
                </div>
                {group.items.map((item) => {
                  const index = flatIndex++;
                  const selected = index === active;
                  return (
                    <div
                      key={item.key}
                      id={optionId(index)}
                      role="option"
                      aria-selected={selected}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseMove={() => {
                        if (!selected) setActiveIndex(index);
                      }}
                      onClick={() => navigate(item)}
                      className={cn(
                        "flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 py-2",
                        selected && "bg-accent text-accent-foreground",
                      )}
                    >
                      <span className="bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md">
                        <Icon aria-hidden="true" className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {item.title}
                        </span>
                        {item.subtitle ? (
                          <span className="text-muted-foreground block truncate text-xs">
                            {item.subtitle}
                          </span>
                        ) : null}
                      </span>
                      {item.amount !== undefined ? (
                        <Money amount={item.amount} size="sm" />
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {!trimmed ? (
          <p className="text-muted-foreground px-2 py-6 text-center text-sm">
            Gõ tên sản phẩm, mã đơn (DH…), tên hoặc số điện thoại khách.
          </p>
        ) : isError ? (
          <p
            role="alert"
            className="text-destructive px-2 py-6 text-center text-sm"
          >
            Không tải được kết quả. Vui lòng thử lại.
          </p>
        ) : loading && options.length === 0 ? (
          <div data-testid="admin-search-loading" className="space-y-2 p-2">
            <span role="status" className="sr-only">
              Đang tìm…
            </span>
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="size-8 shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          </div>
        ) : !loading && options.length === 0 ? (
          <EmptyState
            size="compact"
            icon={MagnifyingGlass}
            title="Không tìm thấy kết quả"
            description={`Không có sản phẩm, đơn hàng hay khách hàng nào khớp “${trimmed}”.`}
          />
        ) : null}
      </div>

      <div className="text-muted-foreground flex items-center gap-3 border-t px-4 py-2 text-xs max-sm:hidden">
        <span>
          <Kbd>↑</Kbd> <Kbd>↓</Kbd> chọn
        </span>
        <span>
          <Kbd>Enter</Kbd> mở
        </span>
        <span>
          <Kbd>Esc</Kbd> đóng
        </span>
      </div>
    </div>
  );
}

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="bg-muted rounded border px-1.5 py-0.5 font-mono text-[0.7rem]">
      {children}
    </kbd>
  );
}
