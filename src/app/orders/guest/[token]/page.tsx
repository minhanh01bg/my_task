import { notFound } from "next/navigation";

import { ClaimOrderButton } from "@/features/customer-account/claim-order-button";
import { CustomerOrderDetail } from "@/features/customer-account/order-detail";
import { OrderTimeline } from "@/features/customer-account/order-timeline";
import { getOptionalCustomerSession } from "@/server/customer-auth/session";
import { findGuestOrder } from "@/server/orders/order-access";
import { getStoreBankAccount } from "@/server/settings/store-settings";

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
  const [access, session] = await Promise.all([
    findGuestOrder(token),
    getOptionalCustomerSession(),
  ]);
  if (!access) notFound();
  const bankAccount =
    access.order.paymentMethod === "bank_transfer" &&
    access.order.status === "pending"
      ? await getStoreBankAccount()
      : null;

  return (
    <div className="mx-auto max-w-3xl">
      <CustomerOrderDetail
        order={access.order}
        bankAccount={bankAccount}
        timeline={<OrderTimeline order={access.order} />}
      />
      <div className="px-4">
        <ClaimOrderButton
          guestToken={token}
          phoneVerified={
            session ? Boolean(session.account.phoneVerifiedAt) : undefined
          }
        />
      </div>
    </div>
  );
}
