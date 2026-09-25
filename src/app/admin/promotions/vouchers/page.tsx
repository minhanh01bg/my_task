import Link from "next/link";
import { TicketPercent } from "lucide-react";

import {
  EmptyState,
  PageHeader,
  Pagination,
  VoucherStatusBadge,
} from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  VoucherForm,
  type VoucherFormValues,
} from "@/features/admin-vouchers/voucher-form";
import { VoucherRowActions } from "@/features/admin-vouchers/voucher-row-actions";
import {
  describeVoucher,
  isVoucherType,
} from "@/lib/vouchers/validate-voucher";
import { parsePageParam } from "@/server/admin/pagination";
import { requireAdminSession } from "@/server/auth/require-admin-session";
import {
  getVoucherById,
  listVouchers,
  VOUCHERS_PAGE_SIZE,
} from "@/server/vouchers/admin-vouchers";
import { toVnDateInput } from "@/types/voucher";

export const dynamic = "force-dynamic";

const PATH = "/admin/promotions/vouchers";

function formatDay(date: Date | null, fallback: string): string {
  return date
    ? new Intl.DateTimeFormat("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        dateStyle: "short",
      }).format(date)
    : fallback;
}

export default async function AdminVouchersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminSession({ redirectToLogin: true });

  const params = await searchParams;
  const editId = typeof params.edit === "string" ? params.edit : null;

  const [result, editing] = await Promise.all([
    listVouchers({ page: parsePageParam(params.page) }),
    editId ? getVoucherById(editId) : null,
  ]);

  const initialData: VoucherFormValues | null = editing
    ? {
        id: editing.id,
        code: editing.code,
        type: editing.type,
        value: editing.value,
        maxDiscount: editing.maxDiscount,
        minOrderTotal: editing.minOrderTotal,
        maxUses: editing.maxUses,
        usedCount: editing.usedCount,
        startsAt: toVnDateInput(editing.startsAt),
        endsAt: toVnDateInput(editing.endsAt),
        isActive: editing.isActive,
      }
    : null;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Khuyến mãi"
        title="Mã giảm giá"
        description="Tạo mã cho khách nhập khi đặt hàng online. Tiền giảm luôn được hệ thống tính lại khi tạo đơn."
        action={
          <Button
            variant="outline"
            className="min-h-11"
            nativeButton={false}
            render={<Link href="/admin/promotions" />}
          >
            Chiến dịch & banner
          </Button>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>
            {initialData ? `Sửa mã ${initialData.code}` : "Tạo mã mới"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <VoucherForm
            key={initialData?.id ?? "new"}
            initialData={initialData}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách mã ({result.total})</CardTitle>
        </CardHeader>
        <CardContent>
          {result.items.length > 0 ? (
            <ul className="divide-y">
              {result.items.map((voucher) => (
                <li
                  key={voucher.id}
                  className="flex flex-col justify-between gap-3 py-4 sm:flex-row sm:items-center"
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono font-bold tracking-wider">
                        {voucher.code}
                      </span>
                      <VoucherStatusBadge voucher={voucher} />
                    </div>
                    <p className="text-muted-foreground text-sm">
                      {isVoucherType(voucher.type)
                        ? describeVoucher({
                            type: voucher.type,
                            value: voucher.value,
                            maxDiscount: voucher.maxDiscount,
                            minOrderTotal: voucher.minOrderTotal,
                          })
                        : voucher.type}
                    </p>
                    <div className="text-muted-foreground flex flex-wrap gap-x-4 text-xs">
                      <span>
                        Đã dùng: {voucher.usedCount.toLocaleString("vi-VN")}
                        {voucher.maxUses !== null
                          ? `/${voucher.maxUses.toLocaleString("vi-VN")}`
                          : " (không giới hạn)"}
                      </span>
                      <span>
                        Hiệu lực: {formatDay(voucher.startsAt, "Ngay")} →{" "}
                        {formatDay(voucher.endsAt, "Không thời hạn")}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      nativeButton={false}
                      render={<Link href={`${PATH}?edit=${voucher.id}`} />}
                    >
                      Sửa
                    </Button>
                    <VoucherRowActions
                      id={voucher.id}
                      code={voucher.code}
                      isActive={voucher.isActive}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              icon={TicketPercent}
              title="Chưa có mã giảm giá nào"
              description="Tạo mã đầu tiên ở khung phía trên."
            />
          )}
          <Pagination
            pathname={PATH}
            page={result.page}
            pageSize={VOUCHERS_PAGE_SIZE}
            total={result.total}
            searchParams={params}
            label="Phân trang mã giảm giá"
          />
        </CardContent>
      </Card>
    </div>
  );
}
