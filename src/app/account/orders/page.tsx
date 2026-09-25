import type { Metadata } from "next";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";

import { EmptyState } from "@/components/kit";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { Button, buttonVariants } from "@/components/ui/button";
import { CustomerLogoutButton } from "@/features/customer-account/logout-button";
import { CustomerOrderCard } from "@/features/customer-account/order-card";
import { CustomerNotificationButton } from "@/features/customer-notifications/notification-button";
import { cn } from "@/lib/utils";
import { requireCustomerSession } from "@/server/customer-auth/session";
import {
  listCustomerOrders,
  type CustomerOrderFilterStatus,
} from "@/server/orders/order-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Đơn hàng của tôi",
  robots: { index: false, follow: false },
};

const STATUS_TABS: Array<{ value: CustomerOrderFilterStatus; label: string }> =
  [
    { value: "all", label: "Tất cả" },
    { value: "pending", label: "Chờ thanh toán" },
    { value: "processing", label: "Đang xử lý" },
    { value: "completed", label: "Hoàn tất" },
    { value: "cancelled", label: "Đã hủy" },
  ];

interface CustomerOrdersPageProps {
  searchParams?: Promise<{ status?: string }>;
}

export default async function CustomerOrdersPage({
  searchParams,
}: CustomerOrdersPageProps) {
  const [params, session] = await Promise.all([
    searchParams ? await searchParams : {},
    requireCustomerSession(),
  ]);

  const activeStatus = (params.status as CustomerOrderFilterStatus) || "all";
  const orders = await listCustomerOrders(
    session.accountId,
    activeStatus === "all" ? undefined : activeStatus,
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-muted-foreground text-sm">
            Xin chào {session.account.displayName}
          </p>
          <h1 className="text-3xl font-bold sm:text-4xl">Đơn hàng của tôi</h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />
          <CustomerNotificationButton enabled placement="page" />
          <CustomerLogoutButton />
        </div>
      </div>

      <nav
        aria-label="Lọc theo trạng thái đơn hàng"
        className="mt-6 flex flex-wrap gap-2"
      >
        {STATUS_TABS.map((tab) => {
          const isActive = activeStatus === tab.value;
          const href =
            tab.value === "all"
              ? "/account/orders"
              : `/account/orders?status=${tab.value}`;
          return (
            <Link
              key={tab.value}
              href={href}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                buttonVariants({
                  variant: isActive ? "default" : "outline",
                  size: "sm",
                }),
                "min-h-10 rounded-full px-4 text-xs font-bold transition-all sm:text-sm",
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {orders.length ? (
        <ul className="mt-6 grid gap-4">
          {orders.map((order) => (
            <CustomerOrderCard
              key={order.id}
              order={order}
              href={`/account/orders/${order.id}`}
            />
          ))}
        </ul>
      ) : (
        <div className="mt-10">
          <EmptyState
            icon={ShoppingBag}
            title={
              activeStatus !== "all"
                ? "Không có đơn hàng nào ở mục này"
                : "Bạn chưa có đơn hàng nào"
            }
            description={
              activeStatus !== "all"
                ? "Các đơn hàng có trạng thái tương ứng sẽ hiển thị ở đây."
                : "Khám phá các sản phẩm chất lượng và đặt mua ngay hôm nay."
            }
            action={
              <Button
                nativeButton={false}
                render={<Link href="/shop" />}
                className="mt-2 font-bold"
              >
                Mua sắm ngay
              </Button>
            }
          />
        </div>
      )}
    </main>
  );
}
