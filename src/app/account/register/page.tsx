import type { Metadata } from "next";

import { CustomerAuthForm } from "@/features/customer-account/auth-form";
import { CustomerAuthShell } from "@/features/customer-account/auth-shell";
import { customerReturnPath } from "@/lib/auth/customer-return-path";
import { getStoreName } from "@/server/settings/store-settings";

export const metadata: Metadata = {
  title: "Tạo tài khoản",
  robots: { index: false, follow: false },
};

export default async function CustomerRegisterPage({
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
    <CustomerAuthShell storeName={storeName} mode="register">
      <CustomerAuthForm mode="register" returnTo={returnTo} />
    </CustomerAuthShell>
  );
}
