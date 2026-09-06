import Link from "next/link";
import { CustomerLogoutButton } from "@/features/customer-account/logout-button";
import { CustomerOrderCard } from "@/features/customer-account/order-card";
import { requireCustomerSession } from "@/server/customer-auth/session";
import { listCustomerOrders } from "@/server/orders/order-access";
export const dynamic = "force-dynamic";
export default async function CustomerOrdersPage() {
  const session = await requireCustomerSession();
  const orders = await listCustomerOrders(session.accountId);
  return (
    <main className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-muted-foreground">
            Xin chào {session.account.displayName}
          </p>
          <h1 className="text-4xl font-bold">Đơn hàng của tôi</h1>
        </div>
        <CustomerLogoutButton />
      </div>
      {orders.length ? (
        <ul className="mt-8 grid gap-4">
          {orders.map((order) => (
            <CustomerOrderCard
              key={order.id}
              order={order}
              href={`/account/orders/${order.id}`}
            />
          ))}
        </ul>
      ) : (
        <div className="mt-12 text-center">
          <p>Bạn chưa có đơn hàng nào.</p>
          <Link
            href="/shop"
            className="text-primary mt-4 inline-block font-bold"
          >
            Mua sắm ngay
          </Link>
        </div>
      )}
    </main>
  );
}
