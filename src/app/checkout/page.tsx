import type { Metadata } from "next";

import { CheckoutForm } from "@/features/online-store/checkout-form";
import {
  getPublicStoreProfile,
  getShippingSettings,
} from "@/server/settings/store-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Thanh toán",
  robots: { index: false, follow: false },
};

export default async function CheckoutPage() {
  const [storeProfile, shipping] = await Promise.all([
    getPublicStoreProfile(),
    getShippingSettings(),
  ]);
  return <CheckoutForm storeProfile={storeProfile} shipping={shipping} />;
}
