import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatVnd } from "@/lib/money";
import { ProductImage } from "@/components/shared/product-image";
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

      <Card>
        <CardHeader>
          <CardTitle>Danh sách ({products.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sản phẩm</TableHead>
                <TableHead>Danh mục</TableHead>
                <TableHead className="text-right">Giá bán</TableHead>
                <TableHead className="text-right">Tồn</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <ProductImage
                        src={product.imageUrl}
                        alt={`Ảnh ${product.name}`}
                        className="size-12"
                      />
                      <div className="min-w-0">
                        <p className="font-bold">{product.name}</p>
                        {product.aliases ? (
                          <p className="text-muted-foreground truncate text-sm">
                            {product.aliases}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {product.category?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatVnd(product.price)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {product.stock < 0 ? (
                      <Badge variant="destructive">
                        {product.stock} {product.unit}
                      </Badge>
                    ) : (
                      <span>
                        {product.stock} {product.unit}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
