import { CustomerAuthForm } from "@/features/customer-account/auth-form";
export default function CustomerRegisterPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16">
      <h1 className="text-center text-4xl font-bold">Tạo tài khoản</h1>
      <CustomerAuthForm mode="register" />
    </main>
  );
}
