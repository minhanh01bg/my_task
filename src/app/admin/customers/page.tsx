import Link from "next/link";
import {
  Lock,
  LockOpen,
  MagnifyingGlass,
  ShoppingBag,
  User,
} from "@phosphor-icons/react/dist/ssr";
import { SearchX, Users } from "lucide-react";

import {
  DataTableShell,
  EmptyState,
  PageHeader,
  Pagination,
} from "@/components/kit";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  listCustomers,
  type AdminCustomerListItem,
} from "@/server/admin/list-customers";
import { parsePageParam } from "@/server/admin/pagination";

import { toggleCustomerAccountAction } from "./actions";

export const dynamic = "force-dynamic";

function CustomerName({ name }: { name: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 font-semibold">
      <span className="bg-primary/10 text-primary flex size-8 shrink-0 items-center justify-center rounded-full font-bold">
        <User aria-hidden="true" className="size-4" />
      </span>
      <span className="text-foreground truncate">{name}</span>
    </div>
  );
}

function AccountStatus({ disabled }: { disabled: boolean }) {
  return disabled ? (
    <Badge variant="destructive" className="font-bold">
      Đã khóa
    </Badge>
  ) : (
    <Badge className="bg-success/12 text-success font-bold">
      Đang hoạt động
    </Badge>
  );
}

function OrdersLink({ account }: { account: AdminCustomerListItem }) {
  return (
    <Link
      href={`/admin/orders?q=${encodeURIComponent(account.phoneNormalized)}`}
      className="text-primary inline-flex min-h-11 items-center gap-1 text-sm font-bold hover:underline"
    >
      <ShoppingBag aria-hidden="true" className="size-4" />
      <span>{account._count.orders} đơn</span>
    </Link>
  );
}

function ToggleAccount({ account }: { account: AdminCustomerListItem }) {
  const isDisabled = Boolean(account.disabledAt);
  return (
    <ConfirmAction
      action={toggleCustomerAccountAction.bind(null, account.id)}
      triggerLabel={isDisabled ? "Mở khóa" : "Khóa tài khoản"}
      triggerVariant={isDisabled ? "outline" : "destructive"}
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
      confirmLabel={isDisabled ? "Mở khóa tài khoản" : "Khóa ngay"}
      triggerIcon={
        isDisabled ? (
          <LockOpen aria-hidden="true" className="size-4" />
        ) : (
          <Lock aria-hidden="true" className="size-4" />
        )
      }
      triggerAriaLabel={
        isDisabled
          ? `Mở khóa tài khoản ${account.displayName}`
          : `Khóa tài khoản ${account.displayName}`
      }
    />
  );
}

interface CustomersPageProps {
  searchParams?: Promise<{ q?: string; page?: string }>;
}

export default async function CustomersPage({
  searchParams,
}: CustomersPageProps) {
  const params = searchParams ? await searchParams : {};
  const q = params?.q?.trim() ?? "";

  const {
    items: accounts,
    total,
    page,
    pageSize,
  } = await listCustomers({ page: parsePageParam(params?.page), q });

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
      <DataTableShell
        title="Danh sách tài khoản"
        count={total}
        isEmpty={accounts.length === 0}
        empty={
          q ? (
            <EmptyState
              icon={SearchX}
              title="Không tìm thấy tài khoản phù hợp"
              description="Thử tìm bằng số điện thoại hoặc một phần tên khách."
            />
          ) : (
            <EmptyState
              icon={Users}
              title="Chưa có tài khoản khách hàng nào"
              description="Khách đăng ký trên cửa hàng online sẽ hiện ở đây."
            />
          )
        }
      >
        {/* Dien thoai: moi tai khoan mot the. */}
        <ul data-layout="cards" className="divide-border divide-y sm:hidden">
          {accounts.map((account) => (
            <li key={account.id} className="space-y-3 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <CustomerName name={account.displayName} />
                <AccountStatus disabled={Boolean(account.disabledAt)} />
              </div>
              <dl className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                <dt className="sr-only">Số điện thoại</dt>
                <dd className="font-mono font-medium">
                  {account.phoneNormalized}
                </dd>
                <dt className="sr-only">Ngày đăng ký</dt>
                <dd className="text-right">
                  {new Date(account.createdAt).toLocaleDateString("vi-VN")}
                </dd>
              </dl>
              <div className="flex items-center justify-between gap-3">
                <OrdersLink account={account} />
                <ToggleAccount account={account} />
              </div>
            </li>
          ))}
        </ul>

        {/* Tu sm tro len: bang, cung mot mang du lieu. */}
        <div data-layout="table" className="hidden sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Khách hàng</TableHead>
                <TableHead>Số điện thoại</TableHead>
                <TableHead>Đơn hàng</TableHead>
                <TableHead>Ngày đăng ký</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead className="pr-6 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="pl-6">
                    <CustomerName name={account.displayName} />
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono font-medium">
                    {account.phoneNormalized}
                  </TableCell>
                  <TableCell>
                    <OrdersLink account={account} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-xs">
                    {new Date(account.createdAt).toLocaleDateString("vi-VN")}
                  </TableCell>
                  <TableCell>
                    <AccountStatus disabled={Boolean(account.disabledAt)} />
                  </TableCell>
                  <TableCell className="pr-6 text-right">
                    <ToggleAccount account={account} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        <Pagination
          pathname="/admin/customers"
          label="Phân trang khách hàng"
          page={page}
          pageSize={pageSize}
          total={total}
          searchParams={{ q }}
          className="px-4 pb-4 sm:px-6"
        />
      </DataTableShell>
    </div>
  );
}
