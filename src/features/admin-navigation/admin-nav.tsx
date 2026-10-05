"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowsClockwise,
  CreditCard,
  Gauge,
  Gear,
  List,
  Megaphone,
  Package,
  ShoppingCart,
  SquaresFour,
  Star,
  Storefront,
  TextAlignLeft,
  Ticket,
  Users,
  X,
  SidebarSimple,
} from "@phosphor-icons/react";

import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { AdminLogoutButton } from "@/features/admin-navigation/admin-logout-button";
import { NotificationButton } from "@/features/admin-notifications/notification-button";
import { AdminSearchButton } from "@/features/admin-search/admin-search-button";
import { cn } from "@/lib/utils";

const NAV = [
  {
    href: "/admin",
    label: "Tổng quan",
    shortLabel: "Tổng quan",
    icon: Gauge,
  },
  {
    href: "/pos",
    label: "Quầy bán hàng",
    shortLabel: "Bán hàng",
    icon: ShoppingCart,
  },
  {
    href: "/shop",
    label: "Xem cửa hàng online",
    shortLabel: "Cửa hàng",
    icon: Storefront,
  },
  {
    href: "/admin/products",
    label: "Sản phẩm",
    shortLabel: "Sản phẩm",
    icon: Package,
  },
  {
    href: "/admin/categories",
    label: "Danh mục",
    shortLabel: "Danh mục",
    icon: SquaresFour,
  },
  {
    href: "/admin/promotions",
    label: "Khuyến mãi",
    shortLabel: "Khuyến mãi",
    icon: Megaphone,
  },
  {
    href: "/admin/promotions/vouchers",
    label: "Mã giảm giá",
    shortLabel: "Mã giảm giá",
    icon: Ticket,
    nested: true,
  },
  {
    href: "/admin/reviews",
    label: "Đánh giá",
    shortLabel: "Đánh giá",
    icon: Star,
  },
  {
    href: "/admin/orders",
    label: "Đơn hàng",
    shortLabel: "Đơn hàng",
    icon: TextAlignLeft,
  },
  {
    href: "/admin/customers",
    label: "Khách hàng",
    shortLabel: "Khách hàng",
    icon: Users,
  },
  {
    href: "/admin/debts",
    label: "Công nợ",
    shortLabel: "Công nợ",
    icon: CreditCard,
  },
  {
    href: "/admin/offline",
    label: "Đơn chờ đồng bộ",
    shortLabel: "Đồng bộ",
    icon: ArrowsClockwise,
  },
  {
    href: "/admin/settings",
    label: "Cài đặt",
    shortLabel: "Cài đặt",
    icon: Gear,
  },
] as const;

const MOBILE_PRIMARY_HREFS = new Set([
  "/pos",
  "/admin/products",
  "/admin/orders",
  "/admin",
]);

const SIDEBAR_STORAGE_KEY = "admin-sidebar-width";
const SIDEBAR_DEFAULT_WIDTH = 250;
const SIDEBAR_MIN_WIDTH = 208;
const SIDEBAR_MAX_WIDTH = 360;
const SIDEBAR_KEYBOARD_STEP = 16;

function clampSidebarWidth(width: number) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
}

type NavItem = (typeof NAV)[number];

/** /pos va /admin (Tong quan) chi sang khi khop chinh xac. */
const EXACT_MATCH_HREFS = new Set(["/pos", "/admin"]);

function matches(pathname: string, href: string) {
  return EXACT_MATCH_HREFS.has(href)
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

/** Muc khop dai nhat thang: o /admin/promotions/vouchers chi "Mã giảm giá" sang. */
function activeHref(pathname: string): string | undefined {
  return NAV.filter((item) => matches(pathname, item.href)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0]?.href;
}

function NavLink({
  item,
  active,
  onNavigate,
  badge,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
  badge?: React.ReactNode;
}) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "hover:bg-accent/12 focus-visible:ring-ring aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:outline-none",
        "nested" in item && item.nested && "pl-8",
      )}
    >
      <item.icon
        aria-hidden="true"
        weight={active ? "fill" : "regular"}
        className="size-5 shrink-0"
      />
      {item.label}
      {badge}
    </Link>
  );
}

export function AdminNav({
  productsBadge,
}: {
  /** Huy hieu (vi du so hang sap het) gan muc "Sản phẩm" — server truyen vao. */
  productsBadge?: React.ReactNode;
} = {}) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navigationHidden, setNavigationHidden] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const currentHref = activeHref(pathname);
  const current = NAV.find((item) => item.href === currentHref);
  const primaryItems = NAV.filter((item) =>
    MOBILE_PRIMARY_HREFS.has(item.href),
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const storedWidth = Number(localStorage.getItem(SIDEBAR_STORAGE_KEY));
      if (Number.isFinite(storedWidth) && storedWidth > 0) {
        setSidebarWidth(clampSidebarWidth(storedWidth));
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function updateSidebarWidth(width: number, persist = false) {
    const nextWidth = clampSidebarWidth(width);
    setSidebarWidth(nextWidth);
    if (persist) {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextWidth));
    }
  }

  function handleResizeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      updateSidebarWidth(sidebarWidth - SIDEBAR_KEYBOARD_STEP, true);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      updateSidebarWidth(sidebarWidth + SIDEBAR_KEYBOARD_STEP, true);
    } else if (event.key === "Home") {
      event.preventDefault();
      updateSidebarWidth(SIDEBAR_MIN_WIDTH, true);
    } else if (event.key === "End") {
      event.preventDefault();
      updateSidebarWidth(SIDEBAR_MAX_WIDTH, true);
    }
  }

  function handleResizeEnd(event: React.PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    updateSidebarWidth(sidebarWidth, true);
  }

  return (
    <>
      <a
        href="#admin-main-content"
        className="bg-background focus:ring-ring fixed top-2 left-2 z-[70] -translate-y-20 rounded-lg px-3 py-2 font-bold shadow-lg focus:translate-y-0 focus:ring-2"
      >
        Bỏ qua menu
      </a>

      <header
        aria-label="Thanh công cụ quản lý"
        className="bg-card/95 border-border sticky top-0 z-40 col-span-full flex h-16 items-center justify-between gap-2 border-b px-4 backdrop-blur-xl"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            className="hidden md:inline-flex"
            aria-expanded={!navigationHidden}
            onClick={() => setNavigationHidden((hidden) => !hidden)}
          >
            <SidebarSimple aria-hidden="true" className="size-5" />
            <span className="sr-only">
              {navigationHidden
                ? "Hiện thanh điều hướng"
                : "Ẩn thanh điều hướng"}
            </span>
          </Button>
          <span className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm">
            <Storefront aria-hidden="true" weight="fill" className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-semibold">
              Quản lý
            </p>
            <p className="truncate font-bold">{current?.label ?? "Cửa hàng"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <AdminSearchButton placement="mobile" />
          <NotificationButton placement="mobile" />
          <AdminLogoutButton className="hidden md:block" />
        </div>
      </header>

      <aside
        data-collapsed={navigationHidden || undefined}
        className={cn(
          "bg-card/85 relative border-r p-5 backdrop-blur-xl max-md:hidden md:sticky md:top-16 md:z-40 md:h-[calc(100dvh-4rem)] md:overflow-y-auto",
          navigationHidden && "md:hidden",
        )}
        style={{ width: sidebarWidth }}
      >
        <div className="mb-5 flex items-center justify-between gap-3 px-2">
          <div className="flex items-center gap-3">
            <span className="bg-primary text-primary-foreground flex size-11 items-center justify-center rounded-2xl shadow-md">
              <Storefront aria-hidden="true" weight="fill" className="size-5" />
            </span>
            <div>
              <p className="font-heading font-bold">Quản lý cửa hàng</p>
              <p className="text-muted-foreground text-xs">
                Dễ nhìn · dễ thao tác
              </p>
            </div>
          </div>
        </div>
        <nav aria-label="Điều hướng quản lý">
          <ul className="flex flex-col gap-1.5">
            {NAV.map((item) => (
              <li key={item.href}>
                <NavLink
                  item={item}
                  active={item.href === currentHref}
                  badge={item.href === "/admin/products" ? productsBadge : null}
                />
              </li>
            ))}
          </ul>
        </nav>
        <div
          role="separator"
          aria-label="Thay đổi chiều rộng thanh điều hướng"
          aria-orientation="vertical"
          aria-valuemin={SIDEBAR_MIN_WIDTH}
          aria-valuemax={SIDEBAR_MAX_WIDTH}
          aria-valuenow={sidebarWidth}
          tabIndex={0}
          className="group focus-visible:ring-primary absolute top-0 right-0 hidden h-full w-2 cursor-col-resize touch-none outline-none focus-visible:ring-2 md:block"
          onDoubleClick={() => updateSidebarWidth(SIDEBAR_DEFAULT_WIDTH, true)}
          onKeyDown={handleResizeKeyDown}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              updateSidebarWidth(event.clientX);
            }
          }}
          onPointerCancel={handleResizeEnd}
          onPointerUp={handleResizeEnd}
        >
          <span className="bg-border group-hover:bg-primary group-focus-visible:bg-primary absolute inset-y-0 right-0 w-px transition-colors" />
        </div>
      </aside>

      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <nav
          aria-label="Điều hướng quản lý trên điện thoại"
          className="bg-card/95 border-border fixed inset-x-0 bottom-0 z-40 border-t px-2 pt-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] shadow-[0_-10px_30px_-20px_oklch(0.15_0.02_70/0.5)] backdrop-blur-xl md:hidden"
        >
          <ul className="grid grid-cols-5">
            {primaryItems.map((item) => {
              const active = item.href === currentHref;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className="text-muted-foreground focus-visible:ring-ring aria-[current=page]:text-primary flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-xl text-[0.68rem] font-bold focus-visible:ring-2 focus-visible:outline-none"
                  >
                    <item.icon
                      aria-hidden="true"
                      weight={active ? "fill" : "regular"}
                      className="size-5"
                    />
                    {item.shortLabel}
                  </Link>
                </li>
              );
            })}
            <li>
              <SheetTrigger
                aria-label="Mở toàn bộ menu quản lý"
                render={<button type="button" />}
                className={cn(
                  "text-muted-foreground focus-visible:ring-ring flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-xl text-[0.68rem] font-bold focus-visible:ring-2 focus-visible:outline-none",
                  menuOpen && "text-primary",
                )}
              >
                <List
                  aria-hidden="true"
                  weight={menuOpen ? "bold" : "regular"}
                  className="size-5"
                />
                Thêm
              </SheetTrigger>
            </li>
          </ul>
        </nav>
        <SheetContent
          side="bottom"
          showCloseButton={false}
          className="gap-0 overflow-y-auto px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] md:hidden"
        >
          <SheetHeader className="mb-3 flex-row items-center justify-between p-0 text-left">
            <div>
              <SheetTitle>Menu quản lý</SheetTitle>
              <SheetDescription>Tất cả chức năng cửa hàng</SheetDescription>
            </div>
            <SheetClose
              aria-label="Đóng menu"
              render={<button type="button" />}
              className="hover:bg-muted focus-visible:ring-ring flex size-11 shrink-0 items-center justify-center rounded-xl focus-visible:ring-2 focus-visible:outline-none"
            >
              <X aria-hidden="true" className="size-5" />
            </SheetClose>
          </SheetHeader>
          <nav aria-label="Toàn bộ chức năng quản lý">
            <ul className="grid grid-cols-1 gap-1 min-[420px]:grid-cols-2">
              {NAV.map((item) => (
                <li key={item.href}>
                  <NavLink
                    item={item}
                    active={item.href === currentHref}
                    onNavigate={() => setMenuOpen(false)}
                    badge={
                      item.href === "/admin/products" ? productsBadge : null
                    }
                  />
                </li>
              ))}
            </ul>
          </nav>
          <div className="border-border mt-3 flex items-center justify-between border-t px-2 pt-3">
            <span className="text-muted-foreground text-sm font-semibold">
              Giao diện sáng / tối
            </span>
            <ThemeToggle />
          </div>
          <AdminLogoutButton
            className="border-border mt-2 border-t pt-3"
            onLogout={() => setMenuOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </>
  );
}
