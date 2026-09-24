import type { Metadata } from "next";

import { CustomerAuthForm } from "@/features/customer-account/auth-form";

export const metadata: Metadata = {
  title: "Đăng nhập khách hàng",
  robots: { index: false, follow: false },
};

export default function CustomerLoginPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-center text-4xl font-bold">Đăng nhập khách hàng</h1>
      <CustomerAuthForm mode="login" />
    </main>
  );
}
