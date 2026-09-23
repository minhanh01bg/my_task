import type { Metadata } from "next";

import { CheckoutForm } from "@/features/online-store/checkout-form";
import { getPublicStoreProfile } from "@/server/settings/store-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Thanh toán",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const storeProfile = await getPublicStoreProfile();
  return <CheckoutForm storeProfile={storeProfile} />;
}
