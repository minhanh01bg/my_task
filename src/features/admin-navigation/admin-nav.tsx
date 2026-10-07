"use client";

import {
  IconRefresh as ArrowsClockwise,
  IconCreditCard as CreditCard,
  IconDashboard as Gauge,
  IconSettings as Gear,
  IconMenu2 as List,
  IconSpeakerphone as Megaphone,
  IconPackage as Package,
  IconShoppingCart as ShoppingCart,
  IconCategory2 as SquaresFour,
  IconStar as Star,
  IconBuildingStore as Storefront,
  IconReceipt as TextAlignLeft,
  IconTicket as Ticket,
  IconUsers as Users,
  IconX as X,
  IconChevronDown,
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
const SIDEBAR_EXPANDED_STORAGE_KEY = "admin-sidebar-expanded-width";
const SIDEBAR_DEFAULT_WIDTH = 250;
const SIDEBAR_MIN_WIDTH = 72;
const SIDEBAR_COMPACT_THRESHOLD = 160;
const SIDEBAR_MAX_WIDTH = 360;
const SIDEBAR_KEYBOARD_STEP = 16;

function clampSidebarWidth(width: number) {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, width));
}

type NavItem = {
  href: string;
  label: string;
  shortLabel: string;
  icon: typeof Gauge;
  nested?: boolean;
};

const TOP_LEVEL_NAV = NAV.filter((item) => !("nested" in item && item.nested));
const PROMOTION_CHILDREN: NavItem[] = [
  {
    ...NAV.find((item) => item.href === "/admin/promotions")!,
    label: "Chiến dịch khuyến mãi",
    nested: true,
  },
  NAV.find((item) => item.href === "/admin/promotions/vouchers")!,
];

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
  compact = false,
}: {
  item: NavItem;
  active: boolean;
  onNavigate?: () => void;
  badge?: React.ReactNode;
  compact?: boolean;
}) {
  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={onNavigate}
      className={cn(
        "admin-sidebar-link hover:bg-accent/12 focus-visible:ring-ring aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground flex min-h-12 items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:outline-none",
        !compact && item.nested && "min-h-11 gap-2 text-[13px] font-medium",
        compact && "relative",
      )}
    >
      <item.icon
        aria-hidden="true"
        className={cn("size-5 shrink-0", item.nested && "size-4")}
      />
      <span className="admin-sidebar-label min-w-0 truncate">{item.label}</span>
      {compact && badge ? (
        <span className="pointer-events-none absolute top-0.5 right-0.5 origin-top-right scale-75">
          {badge}
        </span>
      ) : (
        badge
      )}
    </Link>
  );
  return (
    <Tooltip disabled={!compact}>
      <TooltipTrigger render={link} />
      <TooltipContent role="tooltip" side="right">
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

function NavGroup({
  item,
  currentHref,
  compact = false,
  onNavigate,
}: {
  item: NavItem;
  currentHref?: string;
  compact?: boolean;
  onNavigate?: () => void;
}) {
  const active = PROMOTION_CHILDREN.some((child) => child.href === currentHref);
  const [expanded, setExpanded] = useState(active);
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  // Leave icon mode without retaining a popup that would reopen on the next resize.
  if (!compact && flyoutOpen) setFlyoutOpen(false);
  const contentId = useId();
  const visible = expanded && !compact;
  const children = (nested: boolean) =>
    PROMOTION_CHILDREN.map((child) => (
      <li key={child.href}>
        <NavLink
          item={{ ...child, nested }}
          active={child.href === currentHref}
          onNavigate={() => {
            setFlyoutOpen(false);
            onNavigate?.();
          }}
        />
      </li>
    ));

  return (
    <Popover
      open={compact && flyoutOpen}
      onOpenChange={(open) => {
        if (compact) setFlyoutOpen(open);
      }}
    >
      <div className="relative">
        <PopoverTrigger
          nativeButton={false}
          render={<Link href={item.href} />}
          role={compact ? "button" : "link"}
          aria-label={item.label}
          aria-haspopup={compact ? "dialog" : undefined}
          aria-expanded={compact ? flyoutOpen : undefined}
          onKeyDown={(event) => {
            if (!compact && event.key === " ") event.preventBaseUIHandler();
          }}
          onKeyUp={(event) => {
            if (!compact && event.key === " ") event.preventBaseUIHandler();
          }}
          onClick={(event) => {
            if (compact) {
              event.preventDefault();
            } else {
              setExpanded(true);
              onNavigate?.();
            }
          }}
          className={cn(
            "admin-sidebar-link hover:bg-accent/12 focus-visible:ring-ring flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:outline-none",
            !compact && "pr-12",
            active && "bg-primary/10 text-primary",
          )}
        >
          <item.icon aria-hidden="true" className="size-5 shrink-0" />
          <span className="admin-sidebar-label min-w-0 truncate">
            {item.label}
          </span>
        </PopoverTrigger>
        {!compact && (
          <button
            type="button"
            aria-label={`Mở/thu mục con ${item.label}`}
            aria-expanded={expanded}
            aria-controls={contentId}
            onClick={() => setExpanded((open) => !open)}
            className="hover:bg-accent/12 focus-visible:ring-ring absolute top-1 right-1 flex size-10 items-center justify-center rounded-lg focus-visible:ring-3 focus-visible:outline-none"
          >
            <IconChevronDown
              aria-hidden="true"
              className={cn(
                "size-4 transition-transform duration-200 motion-reduce:transition-none",
                expanded && "rotate-180",
              )}
            />
          </button>
        )}
      </div>
      <div
        id={contentId}
        aria-hidden={!visible}
        inert={!visible}
        className={cn(
          "grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none",
          visible ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="min-h-0 overflow-hidden">
          <ul
            aria-label="Chức năng khuyến mãi"
            className="border-primary/15 mt-1.5 ml-5 space-y-1 border-l pl-1"
          >
            {children(true)}
          </ul>
        </div>
      </div>
      <PopoverContent
        side="right"
        align="start"
        sideOffset={12}
        className="w-64 p-2"
      >
        <PopoverTitle className="px-3 py-2 text-sm">{item.label}</PopoverTitle>
        <ul className="space-y-1">{children(false)}</ul>
      </PopoverContent>
    </Popover>
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
  const [resizing, setResizing] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const expandedWidth = useRef(SIDEBAR_DEFAULT_WIDTH);
  const compact = sidebarWidth <= SIDEBAR_COMPACT_THRESHOLD;
  const currentHref = activeHref(pathname);
  const current = NAV.find((item) => item.href === currentHref);
  const primaryItems = NAV.filter((item) =>
    MOBILE_PRIMARY_HREFS.has(item.href),
  );

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      const storedExpandedWidth = Number(
        localStorage.getItem(SIDEBAR_EXPANDED_STORAGE_KEY),
      );
      if (
        Number.isFinite(storedExpandedWidth) &&
        storedExpandedWidth > SIDEBAR_COMPACT_THRESHOLD
      ) {
        expandedWidth.current = clampSidebarWidth(storedExpandedWidth);
      }
      const storedWidth = Number(localStorage.getItem(SIDEBAR_STORAGE_KEY));
      if (Number.isFinite(storedWidth) && storedWidth > 0) {
        const nextWidth = clampSidebarWidth(storedWidth);
        setSidebarWidth(nextWidth);
        if (nextWidth > SIDEBAR_COMPACT_THRESHOLD)
          expandedWidth.current = nextWidth;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  function updateSidebarWidth(width: number, persist = false) {
    const nextWidth = clampSidebarWidth(width);
    setSidebarWidth(nextWidth);
    if (persist && nextWidth > SIDEBAR_COMPACT_THRESHOLD)
      expandedWidth.current = nextWidth;
    if (persist) {
      localStorage.setItem(SIDEBAR_STORAGE_KEY, String(nextWidth));
      localStorage.setItem(
        SIDEBAR_EXPANDED_STORAGE_KEY,
        String(expandedWidth.current),
      );
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
    setResizing(false);
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
        className="bg-card/95 border-border sticky top-0 z-40 col-start-1 row-start-1 flex h-16 items-center justify-between gap-2 border-b px-4 backdrop-blur-xl md:col-start-2"
      >
        <div className="flex min-w-0 items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="hidden size-11 md:inline-flex"
            aria-controls="admin-desktop-sidebar"
            aria-expanded={!compact}
            onClick={() =>
              updateSidebarWidth(
                compact ? expandedWidth.current : SIDEBAR_MIN_WIDTH,
                true,
              )
            }
          >
            {compact ? (
              <IconLayoutSidebarLeftExpand
                aria-hidden="true"
                className="size-5"
              />
            ) : (
              <IconLayoutSidebarLeftCollapse
                aria-hidden="true"
                className="size-5"
              />
            )}
            <span className="sr-only">
              {compact
                ? "Mở rộng thanh điều hướng"
                : "Thu gọn thanh điều hướng"}
            </span>
          </Button>
          <div className="min-w-0">
            <p className="text-muted-foreground text-xs font-semibold">
              Quản lý
            </p>
            <p className="truncate font-bold">{current?.label ?? "Cửa hàng"}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/shop"
            prefetch={false}
            aria-label="Xem cửa hàng online"
            title="Xem cửa hàng online"
            className={cn(
              buttonVariants({ variant: "outline" }),
              "size-11 shrink-0 px-0 lg:w-auto lg:px-3",
            )}
          >
            <Storefront aria-hidden="true" className="size-5" />
            <span className="hidden lg:inline">Xem cửa hàng online</span>
          </Link>
          <ThemeToggle />
          <AdminSearchButton placement="mobile" />
          <NotificationButton placement="mobile" />
          <AdminLogoutButton compact className="hidden md:block" />
        </div>
      </header>

      <aside
        id="admin-desktop-sidebar"
        data-compact={compact || undefined}
        data-resizing={resizing || undefined}
        className="admin-sidebar bg-card/85 relative flex-col border-r backdrop-blur-xl max-md:hidden md:sticky md:top-0 md:z-40 md:col-start-1 md:row-span-2 md:row-start-1 md:flex md:h-dvh md:self-start"
        style={{ width: sidebarWidth }}
      >
        <div
          className={cn(
            "admin-sidebar-brand flex h-16 shrink-0 items-center gap-3 px-4",
            compact && "gap-0",
          )}
        >
          <span className="bg-primary text-primary-foreground flex size-10 shrink-0 items-center justify-center rounded-xl shadow-sm">
            <Storefront aria-hidden="true" className="size-5" />
          </span>
          <div
            className="admin-sidebar-label min-w-0"
            aria-hidden={compact || undefined}
          >
            <p className="font-heading truncate font-bold">Quản lý cửa hàng</p>
            <p className="text-muted-foreground truncate text-xs">
              Dễ nhìn · dễ thao tác
            </p>
          </div>
        </div>
        <TooltipProvider>
          <nav
            aria-label="Điều hướng quản lý"
            className={cn(
              "admin-sidebar-menu min-h-0 flex-1 overflow-x-hidden overflow-y-auto p-5 pt-3 [scrollbar-width:thin]",
              compact && "px-2",
            )}
          >
            <ul className="flex flex-col gap-1.5">
              {TOP_LEVEL_NAV.map((item) => (
                <li key={item.href}>
                  {item.href === "/admin/promotions" ? (
                    <NavGroup
                      key={pathname}
                      item={item}
                      currentHref={currentHref}
                      compact={compact}
                    />
                  ) : (
                    <NavLink
                      item={item}
                      active={item.href === currentHref}
                      compact={compact}
                      badge={
                        item.href === "/admin/products" ? productsBadge : null
                      }
                    />
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </TooltipProvider>
        <div
          role="separator"
          aria-label="Thay đổi chiều rộng thanh điều hướng"
          aria-orientation="vertical"
          aria-valuemin={SIDEBAR_MIN_WIDTH}
          aria-valuemax={SIDEBAR_MAX_WIDTH}
          aria-valuenow={sidebarWidth}
          aria-valuetext={
            compact ? `Chỉ biểu tượng, ${sidebarWidth}px` : `${sidebarWidth}px`
          }
          tabIndex={0}
          className="group focus-visible:ring-primary absolute top-0 right-0 hidden h-full w-2 cursor-col-resize touch-none outline-none focus-visible:ring-2 md:block"
          onDoubleClick={() => updateSidebarWidth(SIDEBAR_DEFAULT_WIDTH, true)}
          onKeyDown={handleResizeKeyDown}
          onPointerDown={(event) => {
            setResizing(true);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
              updateSidebarWidth(event.clientX);
            }
          }}
          onLostPointerCapture={() => setResizing(false)}
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
                    <item.icon aria-hidden="true" className="size-5" />
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
                <List aria-hidden="true" className="size-5" />
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
              {TOP_LEVEL_NAV.map((item) => (
                <li key={item.href}>
                  {item.href === "/admin/promotions" ? (
                    <NavGroup
                      key={pathname}
                      item={item}
                      currentHref={currentHref}
                      onNavigate={() => setMenuOpen(false)}
                    />
                  ) : (
                    <NavLink
                      item={item}
                      active={item.href === currentHref}
                      onNavigate={() => setMenuOpen(false)}
                      badge={
                        item.href === "/admin/products" ? productsBadge : null
                      }
                    />
                  )}
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
