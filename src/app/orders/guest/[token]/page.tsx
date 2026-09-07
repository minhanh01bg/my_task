import { notFound } from "next/navigation";
import { ClaimOrderButton } from "@/features/customer-account/claim-order-button";
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

  return (
    <div className="mx-auto max-w-3xl">
      <CustomerOrderDetail order={access.order} />
      <div className="px-4">
        <ClaimOrderButton guestToken={token} />
      </div>
    </div>
  );
}
