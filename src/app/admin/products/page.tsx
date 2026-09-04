import { formatVnd } from "@/lib/money";
import { prisma } from "@/server/db/prisma";

import { ProductForm } from "./product-form";

export const dynamic = "force-dynamic";

export default async function ProductsPage() {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, sortOrder: true },
    }),
    prisma.product.findMany({
      where: { deletedAt: null },
      orderBy: { name: "asc" },
      include: { category: { select: { name: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Sản phẩm</h1>

      <ProductForm categories={categories} />

      <table className="w-full text-left">
        <thead className="border-b text-sm text-muted-foreground">
          <tr>
            <th className="py-2">Tên</th>
            <th>Danh mục</th>
            <th className="text-right">Giá bán</th>
            <th className="text-right">Tồn</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id} className="border-b">
              <td className="py-2">
                <span className="font-medium">{product.name}</span>
                {product.aliases ? (
                  <span className="ml-2 text-sm text-muted-foreground">
                    ({product.aliases})
                  </span>
                ) : null}
              </td>
              <td className="text-sm text-muted-foreground">
                {product.category?.name ?? "—"}
              </td>
              <td className="text-right tabular-nums">
                {formatVnd(product.price)}
              </td>
              <td className="text-right tabular-nums">
                <span className={product.stock < 0 ? "text-red-600" : undefined}>
                  {product.stock} {product.unit}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
