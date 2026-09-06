import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { prisma } from "@/server/db/prisma";
import { formatVnd } from "@/lib/money";

export const dynamic = "force-dynamic";
export default async function OrderSuccessPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const order = await prisma.order.findFirst({
    where: { code, channel: "online" },
    select: { code: true, total: true, paymentMethod: true },
  });
  if (!order) notFound();
  return (
    <main className="mx-auto max-w-xl px-4 py-24 text-center">
      <CheckCircle2
        aria-hidden="true"
        className="text-primary mx-auto size-16"
      />
      <h1 className="mt-5 text-4xl font-bold">Đặt hàng thành công</h1>
      <p className="text-muted-foreground mt-3">Mã đơn của bạn</p>
      <p className="mt-2 text-2xl font-bold">{order.code}</p>
      <p className="mt-5 text-xl">
        Tổng cộng: <strong>{formatVnd(order.total)} ₫</strong>
      </p>
      <p className="text-muted-foreground mt-3">
        {order.paymentMethod === "bank_transfer"
          ? "Cửa hàng sẽ liên hệ hướng dẫn chuyển khoản."
          : "Bạn thanh toán khi nhận hàng."}
      </p>
      <Link
        href="/shop"
        className="bg-primary text-primary-foreground mt-8 inline-flex min-h-11 items-center rounded-xl px-5 font-bold"
      >
        Tiếp tục mua sắm
      </Link>
    </main>
  );
}
