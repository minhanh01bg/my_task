import { PageHeader } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { prisma } from "@/server/db/prisma";

import { saveCategoryAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });

  return (
    <div className="max-w-xl space-y-6">
      <PageHeader
        title="Danh mục"
        description="Nhóm hàng hoá, quyết định thứ tự các chip trên màn bán hàng."
      />

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
              <li key={category.id} className="flex justify-between py-3">
                <span>{category.name}</span>
                <span className="text-muted-foreground text-sm">
                  {category._count.products} sản phẩm
                </span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
