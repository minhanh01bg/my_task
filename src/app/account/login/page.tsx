import type { Metadata } from "next";

import { CustomerAuthForm } from "@/features/customer-account/auth-form";
import { CustomerAuthShell } from "@/features/customer-account/auth-shell";
import { customerReturnPath } from "@/lib/auth/customer-return-path";
import { getStoreName } from "@/server/settings/store-settings";

export const metadata: Metadata = {
  title: "Đăng nhập khách hàng",
  robots: { index: false, follow: false },
};

export default async function CustomerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const next = (await searchParams).next;
  const returnTo = customerReturnPath(
    typeof next === "string" ? next : undefined,
  );
  const storeName = await getStoreName();
  return (
    <CustomerAuthShell storeName={storeName} mode="login">
      <CustomerAuthForm mode="login" returnTo={returnTo} />
    </CustomerAuthShell>
  );
}
