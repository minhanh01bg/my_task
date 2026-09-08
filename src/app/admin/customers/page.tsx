import Link from "next/link";
import {
  Lock,
  LockOpen,
  MagnifyingGlass,
  ShoppingBag,
  User,
} from "@phosphor-icons/react/dist/ssr";

import { PageHeader } from "@/components/kit";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/server/db/prisma";

import { toggleCustomerAccountAction } from "./actions";

export const dynamic = "force-dynamic";

interface CustomersPageProps {
  searchParams?: Promise<{ q?: string }>;
}

export default async function CustomersPage({
  searchParams,
}: CustomersPageProps) {
  const params = searchParams ? await searchParams : {};
  const q = params?.q?.trim() ?? "";

  const accounts = await prisma.customerAccount.findMany({
    where: q
      ? {
          OR: [
            { displayName: { contains: q } },
            { phoneNormalized: { contains: q } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { orders: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Khách hàng & Tài khoản"
        description="Quản lý danh sách tài khoản khách hàng, trạng thái hoạt động và lịch sử đơn hàng."
      />

      {/* Thanh tìm kiếm */}
      <Card>
        <CardContent className="p-4 sm:p-6">
          <form method="GET" action="/admin/customers" className="flex gap-2">
            <div className="relative flex-1">
              <MagnifyingGlass
                aria-hidden="true"
                className="text-muted-foreground pointer-events-none absolute top-3.5 left-3 size-4"
              />
              <Input
                name="q"
                defaultValue={q}
                placeholder="Tìm theo tên hoặc số điện thoại khách hàng…"
                className="pl-9"
              />
            </div>
            <Button type="submit">Tìm kiếm</Button>
            {q ? (
              <Button
                variant="ghost"
                nativeButton={false}
                render={<Link href="/admin/customers" />}
              >
                Xóa tìm kiếm
              </Button>
            ) : null}
          </form>
        </CardContent>
      </Card>

      {/* Danh sách tài khoản */}
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-4">
          <CardTitle>Danh sách tài khoản ({accounts.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 sm:p-6 sm:pt-0">
          {accounts.length === 0 ? (
            <div className="text-muted-foreground p-8 text-center text-sm">
              {q
                ? "Không tìm thấy tài khoản phù hợp với từ khóa."
                : "Chưa có tài khoản khách hàng nào đăng ký trên hệ thống."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-border text-muted-foreground border-b text-xs font-bold uppercase">
                    <th className="p-4 pl-6">Khách hàng</th>
                    <th className="p-4">Số điện thoại</th>
                    <th className="p-4">Đơn hàng</th>
                    <th className="p-4">Ngày đăng ký</th>
                    <th className="p-4">Trạng thái</th>
                    <th className="p-4 pr-6 text-right">Thao tác</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {accounts.map((account) => {
                    const isDisabled = Boolean(account.disabledAt);

                    return (
                      <tr
                        key={account.id}
                        className="hover:bg-muted/40 transition-colors"
                      >
                        <td className="p-4 pl-6 font-semibold">
                          <div className="flex items-center gap-2.5">
                            <span className="bg-primary/10 text-primary flex size-8 items-center justify-center rounded-full font-bold">
                              <User className="size-4" />
                            </span>
                            <span className="text-foreground">
                              {account.displayName}
                            </span>
                          </div>
                        </td>
                        <td className="text-muted-foreground p-4 font-mono font-medium">
                          {account.phoneNormalized}
                        </td>
                        <td className="p-4">
                          <Link
                            href={`/admin/orders?q=${encodeURIComponent(account.phoneNormalized)}`}
                            className="text-primary inline-flex items-center gap-1 font-bold hover:underline"
                          >
                            <ShoppingBag className="size-4" />
                            <span>{account._count.orders} đơn</span>
                          </Link>
                        </td>
                        <td className="text-muted-foreground p-4 text-xs">
                          {new Date(account.createdAt).toLocaleDateString(
                            "vi-VN",
                          )}
                        </td>
                        <td className="p-4">
                          {isDisabled ? (
                            <Badge variant="destructive" className="font-bold">
                              Đã khóa
                            </Badge>
                          ) : (
                            <Badge
                              variant="default"
                              className="bg-emerald-600 font-bold hover:bg-emerald-600"
                            >
                              Đang hoạt động
                            </Badge>
                          )}
                        </td>
                        <td className="p-4 pr-6 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <ConfirmAction
                              action={toggleCustomerAccountAction.bind(
                                null,
                                account.id,
                              )}
                              triggerLabel={
                                isDisabled ? "Mở khóa" : "Khóa tài khoản"
                              }
                              triggerVariant={
                                isDisabled ? "outline" : "destructive"
                              }
                              title={
                                isDisabled
                                  ? `Mở khóa tài khoản “${account.displayName}”?`
                                  : `Khóa tài khoản “${account.displayName}”?`
                              }
                              description={
                                isDisabled
                                  ? "Khách hàng sẽ có thể đăng nhập lại và tiếp tục đặt hàng trên cửa hàng online."
                                  : "Khách hàng sẽ bị thu hồi phiên đăng nhập hiện tại và không thể đăng nhập cho đến khi được mở khóa."
                              }
                              confirmLabel={
                                isDisabled ? "Mở khóa tài khoản" : "Khóa ngay"
                              }
                              triggerIcon={
                                isDisabled ? (
                                  <LockOpen className="size-4" />
                                ) : (
                                  <Lock className="size-4" />
                                )
                              }
                              triggerAriaLabel={
                                isDisabled
                                  ? `Mở khóa tài khoản ${account.displayName}`
                                  : `Khóa tài khoản ${account.displayName}`
                              }
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
