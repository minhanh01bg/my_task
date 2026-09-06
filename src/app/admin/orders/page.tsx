import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";

import { Money, PageHeader } from "@/components/kit";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownField } from "@/components/kit/dropdown-field";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/server/db/prisma";

import { cancelOrderAction } from "./actions";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const STATUS_LABEL: Record<string, string> = {
  paid: "Đã thanh toán",
  pending: "Chờ thanh toán",
  debt: "Ghi nợ",
  cancelled: "Đã huỷ",
};
const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  paid: "default",
  pending: "secondary",
  debt: "outline",
  cancelled: "outline",
};

interface OrdersSearchParams {
  status?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: string;
}

function buildPageHref(params: OrdersSearchParams, page: number) {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  query.set("page", String(page));
  return `/admin/orders?${query.toString()}`;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<OrdersSearchParams>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "";
  const from = params.from ?? "";
  const to = params.to ?? "";
  const requestedPage = Math.max(
    1,
    Number.parseInt(params.page ?? "1", 10) || 1,
  );
  const start = from ? new Date(`${from}T00:00:00`) : null;
  const end = to ? new Date(`${to}T23:59:59.999`) : null;
  const where = {
    ...(status ? { status } : {}),
    ...(start || end
      ? {
          createdAt: {
            ...(start ? { gte: start } : {}),
            ...(end ? { lte: end } : {}),
          },
        }
      : {}),
    ...(q
      ? {
          OR: [
            { code: { contains: q } },
            { customer: { is: { name: { contains: q } } } },
            { customer: { is: { phone: { contains: q } } } },
          ],
        }
      : {}),
  };
  const totalCount = await prisma.order.count({ where });
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);
  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      customer: { select: { name: true, phone: true } },
      items: { select: { nameSnapshot: true, quantity: true, unit: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Đơn hàng"
        description="Tìm nhanh theo mã đơn, tên hoặc số điện thoại khách hàng."
      />

      <form className="surface-panel grid gap-3 p-4 lg:grid-cols-[minmax(16rem,1.5fr)_repeat(3,minmax(10rem,1fr))_auto] lg:items-end">
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Tìm đơn hoặc khách hàng
          <span className="relative">
            <MagnifyingGlass
              aria-hidden="true"
              className="text-muted-foreground absolute top-1/2 left-3 size-5 -translate-y-1/2"
            />
            <input
              name="q"
              defaultValue={q}
              placeholder="Ví dụ: DH-102, cô Lan, 0912…"
              className="border-input bg-background h-12 w-full rounded-xl border pr-3 pl-10 font-medium outline-none focus-visible:ring-3"
            />
          </span>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Trạng thái
          <DropdownField
            name="status"
            defaultValue={status}
            aria-label="Trạng thái đơn hàng"
            options={[
              { value: "", label: "Tất cả trạng thái" },
              { value: "paid", label: "Đã thanh toán" },
              { value: "debt", label: "Ghi nợ" },
              { value: "cancelled", label: "Đã hủy" },
              { value: "pending", label: "Chờ thanh toán" },
            ]}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Từ ngày
          <input
            name="from"
            type="date"
            defaultValue={from}
            className="border-input bg-background h-12 rounded-xl border px-3 font-medium"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Đến ngày
          <input
            name="to"
            type="date"
            defaultValue={to}
            className="border-input bg-background h-12 rounded-xl border px-3 font-medium"
          />
        </label>
        <div className="flex gap-2">
          <Button type="submit" className="min-h-12">
            Tìm đơn
          </Button>
          {q || status || from || to ? (
            <Button
              variant="ghost"
              className="min-h-12"
              nativeButton={false}
              render={<Link href="/admin/orders" />}
            >
              Xóa lọc
            </Button>
          ) : null}
        </div>
      </form>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle>{totalCount} đơn hàng</CardTitle>
          <span className="text-muted-foreground text-sm font-semibold">
            Trang {page}/{totalPages}
          </span>
        </CardHeader>
        <CardContent>
          {orders.length === 0 ? (
            <p className="text-muted-foreground py-10 text-center">
              Không tìm thấy đơn phù hợp
            </p>
          ) : (
            <ul className="divide-y">
              {orders.map((order) => (
                <li
                  key={order.id}
                  className="grid gap-4 py-4 lg:grid-cols-[1fr_auto] lg:items-start"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="hover:text-primary focus-visible:ring-ring rounded font-bold underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {order.code}
                      </Link>
                      <Badge
                        variant={STATUS_VARIANT[order.status] ?? "outline"}
                      >
                        {STATUS_LABEL[order.status] ?? order.status}
                      </Badge>
                      {order.hasStockWarning ? (
                        <Badge variant="destructive">Tồn âm</Badge>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground mt-1 truncate text-sm">
                      {order.items
                        .map((item) => `${item.nameSnapshot} ×${item.quantity}`)
                        .join(", ")}
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      {order.createdAt.toLocaleString("vi-VN")}
                      {order.customer
                        ? ` · ${order.customer.name}${order.customer.phone ? ` · ${order.customer.phone}` : ""}`
                        : " · Khách lẻ"}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 lg:justify-end">
                    <span className="text-lg font-bold tabular-nums">
                      <Money amount={order.total} />
                    </span>
                    {order.status !== "cancelled" ? (
                      <ConfirmAction
                        action={cancelOrderAction.bind(null, order.id)}
                        triggerLabel="Hủy đơn"
                        title={`Hủy đơn ${order.code}?`}
                        description="Tồn kho của các sản phẩm trong đơn sẽ được hoàn lại. Thao tác này không thể hoàn tác."
                        confirmLabel="Xác nhận hủy đơn"
                        triggerClassName="text-destructive"
                      />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
          {totalPages > 1 ? (
            <nav
              aria-label="Phân trang đơn hàng"
              className="border-border mt-4 flex items-center justify-between border-t pt-4"
            >
              <Button
                variant="outline"
                disabled={page <= 1}
                nativeButton={page <= 1}
                render={
                  page > 1 ? (
                    <Link href={buildPageHref(params, page - 1)} />
                  ) : undefined
                }
              >
                Trang trước
              </Button>
              <span className="text-sm font-bold">
                {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, totalCount)} / {totalCount}
              </span>
              <Button
                variant="outline"
                disabled={page >= totalPages}
                nativeButton={page >= totalPages}
                render={
                  page < totalPages ? (
                    <Link href={buildPageHref(params, page + 1)} />
                  ) : undefined
                }
              >
                Trang sau
              </Button>
            </nav>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
