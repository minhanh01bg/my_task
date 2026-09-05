import { ArrowDown, ArrowUp } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/server/db/prisma";

import {
  deleteCategoryAction,
  moveCategoryAction,
  saveCategoryAction,
} from "./actions";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="eyebrow">Sắp xếp quầy hàng</p>
        <h1 className="font-heading mt-1 text-3xl font-bold">Danh mục</h1>
        <p className="text-muted-foreground mt-1">
          Thứ tự tại đây cũng là thứ tự hiển thị ở quầy bán hàng.
        </p>
      </div>

      <Card>
        <CardContent>
          <form action={saveCategoryAction} className="flex items-end gap-2">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="category-name">Tên danh mục</Label>
              <Input id="category-name" name="name" required />
            </div>
            <input
              type="hidden"
              name="sortOrder"
              value={categories.length + 1}
            />
            <Button type="submit">Thêm</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Danh sách ({categories.length})</CardTitle>
        </CardHeader>
        <CardContent>
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
                      action={moveCategoryAction.bind(null, category.id, "up")}
                    >
                      <Button
                        type="submit"
                        variant="outline"
                        size="icon"
                        disabled={index === 0}
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
                        disabled={index === categories.length - 1}
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
        </CardContent>
      </Card>
    </div>
  );
}
