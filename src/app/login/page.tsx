import type { Metadata } from "next";
import { ShieldCheck, Store } from "lucide-react";

import { getStoreName } from "@/server/settings/store-settings";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const storeName = await getStoreName();
  return {
    title: `Đăng nhập - ${storeName}`,
    description: `Đăng nhập hệ thống quản lý và bán hàng ${storeName}`,
  };
}

export default async function LoginPage() {
  const storeName = await getStoreName();

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1fr_1.1fr]">
      <section className="bg-primary text-primary-foreground relative hidden flex-col justify-between overflow-hidden p-10 lg:flex xl:p-16">
        <div
          aria-hidden="true"
          className="absolute -top-32 -right-24 size-96 rounded-full bg-white/8 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="bg-accent/15 absolute -bottom-32 -left-24 size-[28rem] rounded-full blur-3xl"
        />
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-2xl border border-white/15 bg-white/10 shadow-lg backdrop-blur-sm">
            <Store aria-hidden="true" className="size-6" />
          </span>
          <span className="font-heading text-xl font-bold">{storeName}</span>
        </div>
        <div className="relative max-w-xl">
          <p className="mb-4 text-sm font-bold tracking-[0.16em] text-white/70 uppercase">
            Bán hàng nhẹ nhàng hơn
          </p>
          <h1 className="font-heading text-4xl leading-tight font-bold text-balance xl:text-5xl">
            Mọi thao tác tại cửa hàng, nay rõ ràng và nhanh chóng.
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-white/75">
            Tìm hàng, tạo đơn và thanh toán trong một quy trình trực quan — kể
            cả khi mất mạng.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-white/70">
          <ShieldCheck aria-hidden="true" className="size-5" /> Dữ liệu cửa hàng
          được bảo vệ
        </div>
      </section>

      <section className="relative flex items-center justify-center p-5 sm:p-8">
        <LoginForm storeName={storeName} />
      </section>
    </main>
  );
}
