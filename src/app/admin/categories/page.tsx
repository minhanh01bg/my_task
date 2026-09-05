import { Button } from "@/components/ui/button";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/server/db/prisma";

import { deleteCategoryAction, saveCategoryAction } from "./actions";

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
            <div className="w-24 space-y-1.5">
              <Label htmlFor="category-order">Thứ tự</Label>
              <Input
                id="category-order"
                name="sortOrder"
                type="number"
                defaultValue="0"
              />
            </div>
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
            {categories.map((category) => (
              <li
                key={category.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"
              >
                <form
                  action={saveCategoryAction}
                  className="grid flex-1 grid-cols-[minmax(0,1fr)_5rem_auto] gap-2"
                >
                  <input type="hidden" name="id" value={category.id} />
                  <Input
                    aria-label={`Tên danh mục ${category.name}`}
                    name="name"
                    defaultValue={category.name}
                    required
                  />
                  <Input
                    aria-label={`Thứ tự ${category.name}`}
                    name="sortOrder"
                    type="number"
                    defaultValue={category.sortOrder}
                  />
                  <Button type="submit" variant="outline">
                    Lưu
                  </Button>
                </form>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
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
