import { notFound } from "next/navigation";
import { CustomerOrderDetail } from "@/features/customer-account/order-detail";
import { findGuestOrder } from "@/server/orders/order-access";
export const dynamic = "force-dynamic";
export const metadata = {
  referrer: "no-referrer" as const,
  robots: { index: false, follow: false },
};
export default async function GuestOrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const access = await findGuestOrder(token);
  if (!access) notFound();
  return <CustomerOrderDetail order={access.order} />;
}
