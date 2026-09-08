import { CheckoutForm } from "@/features/online-store/checkout-form";
import { getPublicStoreProfile } from "@/server/settings/store-settings";

export const dynamic = "force-dynamic";

export default async function CheckoutPage() {
  const storeProfile = await getPublicStoreProfile();
  return <CheckoutForm storeProfile={storeProfile} />;
}
