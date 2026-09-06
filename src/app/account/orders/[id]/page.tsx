import { notFound } from "next/navigation";
import { CustomerOrderDetail } from "@/features/customer-account/order-detail";
import { requireCustomerSession } from "@/server/customer-auth/session";
import { findOwnedCustomerOrder } from "@/server/orders/order-access";
export const dynamic = "force-dynamic";
export default async function CustomerOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, session] = await Promise.all([
    params,
    requireCustomerSession(),
  ]);
  const order = await findOwnedCustomerOrder(session.accountId, id);
  if (!order) notFound();
  return <CustomerOrderDetail order={order} />;
}
