import { Button } from "@/components/ui/button";
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
      <h1 className="text-2xl font-semibold">Danh mục</h1>

      <form action={saveCategoryAction} className="flex items-end gap-2">
        <label className="flex-1">
          <span className="text-sm text-muted-foreground">Tên danh mục</span>
          <input
            name="name"
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <label className="w-24">
          <span className="text-sm text-muted-foreground">Thứ tự</span>
          <input
            name="sortOrder"
            type="number"
            defaultValue="0"
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </label>
        <Button type="submit">Thêm</Button>
      </form>

      <ul className="divide-y">
        {categories.map((category) => (
          <li key={category.id} className="flex justify-between py-3">
            <span>{category.name}</span>
            <span className="text-sm text-muted-foreground">
              {category._count.products} sản phẩm
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
