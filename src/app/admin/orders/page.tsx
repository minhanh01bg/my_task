import Link from "next/link";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { ReceiptText, SearchX } from "lucide-react";

import { EmptyState, Money, PageHeader, Pagination } from "@/components/kit";
import { DateField } from "@/components/kit/date-field";
import { DropdownField } from "@/components/kit/dropdown-field";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listOrders,
  type AdminOrderListItem,
} from "@/server/admin/list-orders";
import { parsePageParam } from "@/server/admin/pagination";
import { requireAdminSession } from "@/server/auth/require-admin-session";
import {
  ONLINE_ORDER_STATUS_LABELS,
  type OnlineOrderStatus,
} from "@/server/orders/online-order-status";

import { cancelOrderAction } from "./actions";

export const dynamic = "force-dynamic";

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

function itemSummary(order: AdminOrderListItem): string {
  return order.items
    .map((item) => `${item.nameSnapshot} ×${item.quantity}`)
    .join(", ");
}

function customerLabel(order: AdminOrderListItem): string {
  if (!order.customer) return "Khách lẻ";
  return order.customer.phone
    ? `${order.customer.name} · ${order.customer.phone}`
    : order.customer.name;
}

function OrderCodeLink({ order }: { order: AdminOrderListItem }) {
  return (
    <Link
      href={`/admin/orders/${order.id}`}
      className="hover:text-primary focus-visible:ring-ring rounded font-bold break-all underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
    >
      {order.code}
    </Link>
  );
}

function OrderBadges({ order }: { order: AdminOrderListItem }) {
  return (
    <>
      <Badge variant={STATUS_VARIANT[order.status] ?? "outline"}>
        {STATUS_LABEL[order.status] ?? order.status}
      </Badge>
      <Badge variant="outline">
        {order.channel === "online" ? "Online" : "Tại quầy"}
      </Badge>
      {order.fulfillmentStatus ? (
        <Badge variant="secondary">
          {ONLINE_ORDER_STATUS_LABELS[
            order.fulfillmentStatus as OnlineOrderStatus
          ] ?? order.fulfillmentStatus}
        </Badge>
      ) : null}
      {order.hasStockWarning ? (
        <Badge variant="destructive">Tồn âm</Badge>
      ) : null}
    </>
  );
}

function CancelOrder({ order }: { order: AdminOrderListItem }) {
  if (order.status === "cancelled" || order.fulfillmentStatus === "completed") {
    return null;
  }
  return (
    <ConfirmAction
      action={cancelOrderAction.bind(null, order.id)}
      triggerLabel="Hủy đơn"
      title={`Hủy đơn ${order.code}?`}
      description="Tồn kho của các sản phẩm trong đơn sẽ được hoàn lại. Thao tác này không thể hoàn tác."
      confirmLabel="Xác nhận hủy đơn"
      triggerClassName="text-destructive text-sm"
    />
  );
}

interface OrdersSearchParams {
  status?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: string;
  channel?: string;
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<OrdersSearchParams>;
}) {
  await requireAdminSession({ redirectToLogin: true });

  const params = await searchParams;
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "";
  const channel = params.channel ?? "";
  const from = params.from ?? "";
  const to = params.to ?? "";
  const {
    items: orders,
    total: totalCount,
    page,
    pageSize,
  } = await listOrders({
    page: parsePageParam(params.page),
    q,
    filters: { status, channel, from, to },
  });
  const hasFilters = Boolean(q || status || channel || from || to);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Đơn hàng"
        description="Tìm nhanh theo mã đơn, tên hoặc số điện thoại khách hàng."
      />

      <form className="surface-panel grid gap-3 p-4 sm:grid-cols-2 sm:items-end md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[minmax(14rem,1.5fr)_repeat(4,minmax(8rem,1fr))_auto]">
        <label className="flex flex-col gap-1.5 text-sm font-bold sm:col-span-2 md:col-span-2 lg:col-span-3 xl:col-span-1">
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
          Kênh bán
          <DropdownField
            name="channel"
            defaultValue={channel}
            aria-label="Kênh bán"
            options={[
              { value: "", label: "Tất cả kênh" },
              { value: "online", label: "Online" },
              { value: "pos", label: "Tại quầy" },
            ]}
          />
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
          <DateField
            name="from"
            defaultValue={from}
            aria-label="Từ ngày"
            placeholder="Chọn ngày bắt đầu"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-bold">
          Đến ngày
          <DateField
            name="to"
            defaultValue={to}
            aria-label="Đến ngày"
            placeholder="Chọn ngày kết thúc"
          />
        </label>
        <div className="flex flex-wrap gap-2 pt-1 sm:col-span-2 sm:pt-0 md:col-span-2 lg:col-span-3 xl:col-span-1">
          <Button type="submit" className="min-h-12 flex-1 sm:flex-initial">
            Tìm đơn
          </Button>
          {hasFilters ? (
            <Button
              variant="ghost"
              className="min-h-12 flex-1 sm:flex-initial"
              nativeButton={false}
              render={<Link href="/admin/orders" />}
            >
              Xóa lọc
            </Button>
          ) : null}
        </div>
      </form>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 p-4 sm:gap-4 sm:p-6">
          <CardTitle>{totalCount} đơn hàng</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          {orders.length === 0 ? (
            hasFilters ? (
              <EmptyState
                icon={SearchX}
                title="Không tìm thấy đơn phù hợp"
                description="Thử bỏ bớt bộ lọc hoặc tìm bằng số điện thoại khách."
              />
            ) : (
              <EmptyState
                icon={ReceiptText}
                title="Chưa có đơn hàng nào"
                description="Đơn bán tại quầy và đơn online sẽ hiện ở đây."
              />
            )
          ) : (
            <>
              {/* Dien thoai: moi don mot the. */}
              <ul data-layout="cards" className="divide-y sm:hidden">
                {orders.map((order) => (
                  <li key={order.id} className="grid gap-3 py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 font-medium">
                        <OrderCodeLink order={order} />
                        <OrderBadges order={order} />
                      </div>
                      <p className="text-muted-foreground mt-1.5 truncate text-sm">
                        {itemSummary(order)}
                      </p>
                      <p className="text-muted-foreground mt-1 text-sm break-words">
                        {order.createdAt.toLocaleString("vi-VN")} ·{" "}
                        {customerLabel(order)}
                      </p>
                    </div>
                    <div className="border-border/50 flex items-center justify-between gap-3 border-t pt-2.5">
                      <span className="text-base font-bold tabular-nums">
                        <Money amount={order.total} />
                      </span>
                      <CancelOrder order={order} />
                    </div>
                  </li>
                ))}
              </ul>

              {/* Tu sm tro len: bang, cung mot mang du lieu. */}
              <div data-layout="table" className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Đơn hàng</TableHead>
                      <TableHead>Khách hàng</TableHead>
                      <TableHead>Thời gian</TableHead>
                      <TableHead className="text-right">Tổng tiền</TableHead>
                      <TableHead className="text-right">
                        <span className="sr-only">Thao tác</span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="max-w-80 whitespace-normal">
                          <div className="flex flex-wrap items-center gap-1.5 font-medium">
                            <OrderCodeLink order={order} />
                            <OrderBadges order={order} />
                          </div>
                          <p className="text-muted-foreground mt-1 truncate text-sm">
                            {itemSummary(order)}
                          </p>
                        </TableCell>
                        <TableCell className="whitespace-normal">
                          {customerLabel(order)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {order.createdAt.toLocaleString("vi-VN")}
                        </TableCell>
                        <TableCell className="text-right font-bold tabular-nums">
                          <Money amount={order.total} />
                        </TableCell>
                        <TableCell className="text-right">
                          <CancelOrder order={order} />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
          <Pagination
            pathname="/admin/orders"
            label="Phân trang đơn hàng"
            page={page}
            pageSize={pageSize}
            total={totalCount}
            searchParams={{ q, status, channel, from, to }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
