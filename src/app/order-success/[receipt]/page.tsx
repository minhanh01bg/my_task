import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, ShoppingBag } from "lucide-react";

import { PrintReceiptButton } from "@/features/online-store/print-receipt-button";
import { formatVnd } from "@/lib/money";
import { getPublicReceipt } from "@/server/orders/public-receipt";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Biên nhận đơn hàng",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function OrderSuccessPage({
  params,
}: {
  params: Promise<{ receipt: string }>;
}) {
  const { receipt } = await params;
  let order;
  try {
    order = await getPublicReceipt(receipt);
  } catch {
    notFound();
  }
  if (!order) notFound();

  return (
    <main className="mx-auto max-w-xl px-4 py-16 text-center sm:py-24">
      <CheckCircle2
        aria-hidden="true"
        className="text-primary mx-auto size-16"
      />
      <h1 className="font-heading mt-5 text-3xl font-extrabold sm:text-4xl">
        Đặt hàng thành công!
      </h1>
      <p className="text-muted-foreground mt-2 text-sm sm:text-base">
        Cảm ơn bạn đã mua hàng. Đơn hàng của bạn đã được ghi nhận vào hệ thống.
      </p>

      {/* Receipt Card */}
      <div className="border-border bg-card mt-8 rounded-2xl border p-6 text-left shadow-xs">
        <div className="flex items-center justify-between border-b pb-4">
          <span className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
            Biên nhận đơn hàng
          </span>
          <PrintReceiptButton />
        </div>

        <div className="mt-4 space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Mã đơn hàng:</span>
            <span className="text-foreground font-mono text-base font-bold">
              {order.code}
            </span>
          </div>

          <div className="flex justify-between">
            <span className="text-muted-foreground">
              Phương thức thanh toán:
            </span>
            <span className="text-foreground font-medium">
              {order.paymentMethod === "bank_transfer"
                ? "Chuyển khoản ngân hàng"
                : "Thanh toán khi nhận hàng (COD)"}
            </span>
          </div>

          <div className="flex justify-between border-t pt-3 text-base">
            <span className="text-foreground font-bold">Tổng cộng:</span>
            <strong className="text-primary font-heading text-xl font-extrabold">
              {formatVnd(order.total)} ₫
            </strong>
          </div>
        </div>

        <div className="border-border bg-muted/40 text-muted-foreground mt-5 rounded-xl p-3.5 text-xs leading-relaxed">
          {order.paymentMethod === "bank_transfer" ? (
            <p>
              Cửa hàng sẽ sớm liên hệ qua số điện thoại để hướng dẫn chuyển
              khoản và tiến hành giao hàng.
            </p>
          ) : (
            <p>
              Bạn sẽ thanh toán số tiền trên khi nhân viên giao hàng tới tận
              tay. Vui lòng giữ mã đơn để đối chiếu.
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/shop"
          className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-6 font-bold transition-colors sm:w-auto"
        >
          <ShoppingBag className="size-4" />
          <span>Tiếp tục mua sắm</span>
        </Link>
      </div>
    </main>
  );
}
