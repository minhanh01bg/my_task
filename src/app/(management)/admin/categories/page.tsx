import { ArrowDown, ArrowUp } from "@phosphor-icons/react/dist/ssr";
import { LayoutGrid } from "lucide-react";

import { EmptyState, PageHeader, Pagination } from "@/components/kit";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireAdminSession } from "@/server/auth/require-admin-session";
import { listAdminCategories } from "@/server/admin/list-categories";
import { parsePageParam } from "@/server/admin/pagination";

import {
  deleteCategoryAction,
  moveCategoryAction,
  saveCategoryAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminSession({ redirectToLogin: true });

  const params = await searchParams;
  const result = await listAdminCategories({
    page: parsePageParam(params.page),
  });
  const categories = result.items;
  const offset = (result.page - 1) * result.pageSize;

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        eyebrow="Sắp xếp quầy hàng"
        title="Danh mục"
        description="Thứ tự tại đây cũng là thứ tự hiển thị ở quầy bán hàng."
      />

      <Card>
        <CardContent>
          <form action={saveCategoryAction} className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="category-name">Tên danh mục</Label>
              <Input id="category-name" name="name" required />
            </div>
            <input type="hidden" name="sortOrder" value={result.total + 1} />
            <Button type="submit">Thêm</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách ({result.total})</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <EmptyState
              icon={LayoutGrid}
              title="Chưa có danh mục nào"
              description="Thêm danh mục ở trên để nhóm sản phẩm tại quầy bán hàng."
            />
          ) : (
            <ul className="divide-y">
              {categories.map((category, index) => (
                <li
                  key={category.id}
                  className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"
                >
                  <form
                    action={saveCategoryAction}
                    className="flex min-w-0 flex-1 gap-2"
                  >
                    <input type="hidden" name="id" value={category.id} />
                    <input
                      type="hidden"
                      name="sortOrder"
                      value={category.sortOrder}
                    />
                    <Input
                      aria-label={`Tên danh mục ${category.name}`}
                      name="name"
                      defaultValue={category.name}
                      required
                    />
                    <Button type="submit" variant="outline">
                      Lưu
                    </Button>
                  </form>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <div
                      className="flex gap-1"
                      aria-label={`Sắp xếp ${category.name}`}
                    >
                      <form
                        action={moveCategoryAction.bind(
                          null,
                          category.id,
                          "up",
                        )}
                      >
                        <Button
                          type="submit"
                          variant="outline"
                          size="icon"
                          disabled={offset + index === 0}
                          aria-label={`Đưa ${category.name} lên trên`}
                        >
                          <ArrowUp aria-hidden="true" weight="bold" />
                        </Button>
                      </form>
                      <form
                        action={moveCategoryAction.bind(
                          null,
                          category.id,
                          "down",
                        )}
                      >
                        <Button
                          type="submit"
                          variant="outline"
                          size="icon"
                          disabled={offset + index === result.total - 1}
                          aria-label={`Đưa ${category.name} xuống dưới`}
                        >
                          <ArrowDown aria-hidden="true" weight="bold" />
                        </Button>
                      </form>
                    </div>
                    <span className="text-muted-foreground text-sm whitespace-nowrap">
                      {category._count.products} sản phẩm
                    </span>
                    <ConfirmAction
                      action={deleteCategoryAction.bind(null, category.id)}
                      triggerLabel="Xóa"
                      title={`Xóa danh mục “${category.name}”?`}
                      description={
                        category._count.products > 0
                          ? `${category._count.products} sản phẩm sẽ được chuyển sang trạng thái chưa phân loại. Sản phẩm không bị xóa.`
                          : "Danh mục sẽ bị xóa khỏi quầy hàng. Thao tác này không thể hoàn tác."
                      }
                      confirmLabel="Xóa danh mục"
                      triggerClassName="text-destructive"
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Pagination
            pathname="/admin/categories"
            page={result.page}
            pageSize={result.pageSize}
            total={result.total}
            searchParams={params}
          />
        </CardContent>
      </Card>
    </div>
  );
}
