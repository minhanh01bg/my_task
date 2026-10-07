import {
  IconArrowDown as ArrowDown,
  IconArrowUp as ArrowUp,
  IconCategory as LayoutGrid,
} from "@tabler/icons-react";

import { EmptyState, PageHeader, Pagination } from "@/components/kit";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { requireAdminSession } from "@/server/auth/require-admin-session";
import { listAdminCategories } from "@/server/admin/list-categories";
import { parsePageParam } from "@/server/admin/pagination";

import { deleteCategoryAction, moveCategoryAction } from "./actions";

import { CategoryForm } from "./category-form";

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
    <div className="max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Sắp xếp quầy hàng"
        title="Danh mục"
        description="Nhóm sản phẩm để khách dễ tìm và quầy bán hàng dễ thao tác."
      />

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle>Thêm nhóm sản phẩm</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryForm sortOrder={result.total + 1} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh mục hiện có ({result.total})</CardTitle>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <EmptyState
              icon={LayoutGrid}
              title="Chưa có danh mục nào"
              description="Thêm danh mục ở trên để nhóm sản phẩm tại quầy bán hàng."
            />
          ) : (
            <>
              <p className="text-muted-foreground mb-4 text-sm">
                Dùng mũi tên để đổi thứ tự hiển thị tại quầy bán hàng.
              </p>
              <ul className="space-y-3">
                {categories.map((category, index) => (
                  <li
                    key={category.id}
                    className="bg-background flex flex-col gap-4 rounded-xl border p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="bg-muted text-muted-foreground mt-6 flex size-11 shrink-0 items-center justify-center rounded-lg text-sm font-semibold tabular-nums"
                        aria-label={`Vị trí ${offset + index + 1}`}
                      >
                        {String(offset + index + 1).padStart(2, "0")}
                      </span>
                      <CategoryForm
                        category={{ id: category.id, name: category.name }}
                        sortOrder={category.sortOrder}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t pt-3">
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
                            <ArrowUp aria-hidden="true" />
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
                            <ArrowDown aria-hidden="true" />
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
            </>
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
