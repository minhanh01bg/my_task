import Link from "next/link";
import { formatVnd } from "@/lib/money";

export function CustomerOrderCard({
  order,
  href,
}: {
  order: {
    code: string;
    createdAt: Date;
    total: number;
    status: string;
    fulfillmentStatus: string | null;
  };
  href: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="border-border hover:border-primary block rounded-2xl border p-5"
      >
        <div className="flex justify-between gap-4">
          <strong>{order.code}</strong>
          <span>{formatVnd(order.total)} ₫</span>
        </div>
        <p className="text-muted-foreground mt-2 text-sm">
          {order.createdAt.toLocaleDateString("vi-VN")} ·{" "}
          {order.fulfillmentStatus ?? order.status}
        </p>
      </Link>
    </li>
  );
}
