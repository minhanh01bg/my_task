import {
  DataTableShell,
  EmptyState,
  Money,
  PageHeader,
  ProductImage,
  StockBadge,
} from "@/components/kit";
import Link from "next/link";
import { Pencil, Search, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { deleteProductAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; edit?: string }>;
}) {
  const { q = "", edit } = await searchParams;
  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, sortOrder: true },
    }),
    prisma.product.findMany({
      where: {
        deletedAt: null,
        ...(q.trim()
          ? {
              OR: [
                { name: { contains: q.trim() } },
                { sku: { contains: q.trim() } },
                { aliases: { contains: q.trim() } },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
      include: { category: { select: { name: true } } },
    }),
  ]);
  const editingProduct = edit
    ? await prisma.product.findFirst({ where: { id: edit, deletedAt: null } })
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sản phẩm"
        description="Hàng hoá đang bán tại quầy. Sửa ở đây là màn bán hàng đổi theo."
      <div>
        <p className="eyebrow">Danh mục hàng hóa</p>
        <h1 className="font-heading mt-1 text-3xl font-bold">Sản phẩm</h1>
        <p className="text-muted-foreground mt-1">
          Thêm ảnh, cập nhật giá, tồn kho và thông tin tìm kiếm.
        </p>
      </div>

      <ProductForm
        categories={categories}
        product={editingProduct ?? undefined}
      />

      <form
        className="surface-panel flex flex-col gap-2 p-3 sm:flex-row"
        role="search"
      >
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2"
          />
          <input
            name="q"
            defaultValue={q}
            aria-label="Tìm sản phẩm"
            placeholder="Tìm theo tên, mã hoặc tên gọi khác"
            className="border-input bg-background focus-visible:ring-ring h-11 w-full rounded-xl border pr-3 pl-10 text-sm outline-none focus-visible:ring-3"
          />
        </div>
        <Button type="submit">Tìm sản phẩm</Button>
        {q ? (
          <Button variant="ghost" render={<Link href="/admin/products" />}>
            Xóa lọc
          </Button>
        ) : null}
      </form>

      <DataTableShell
        title="Danh sách"
        count={products.length}
        isEmpty={products.length === 0}
        empty={
          <EmptyState
            title="Chưa có sản phẩm nào"
            description="Thêm sản phẩm đầu tiên để bắt đầu bán hàng."
          />
        }
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tên</TableHead>
              <TableHead>Danh mục</TableHead>
              <TableHead className="text-right">Giá bán</TableHead>
              <TableHead className="text-right">Tồn</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id} className="hover:bg-accent/50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <ProductImage
                      src={product.imageUrl}
                      name={product.name}
                      size={40}
                    />
                    <div className="flex flex-col">
                      <span className="font-medium">{product.name}</span>
                      {product.aliases ? (
                        <span className="text-muted-foreground text-sm">
                          {product.aliases}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {product.category?.name ?? "—"}
                </TableCell>
                <TableCell className="text-right">
                  <Money amount={product.price} />
                </TableCell>
                <TableCell className="text-right">
                  <StockBadge stock={product.stock} unit={product.unit} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </DataTableShell>
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
                <TableHead>
                  <span className="sr-only">Thao tác</span>
                </TableHead>
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
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Sửa ${product.name}`}
                        render={
                          <Link
                            href={`/admin/products?edit=${product.id}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                          />
                        }
                      >
                        <Pencil aria-hidden="true" />
                      </Button>
                      <form action={deleteProductAction.bind(null, product.id)}>
                        <Button
                          type="submit"
                          variant="ghost"
                          size="icon"
                          aria-label={`Xóa ${product.name}`}
                          className="text-destructive"
                        >
                          <Trash2 aria-hidden="true" />
                        </Button>
                      </form>
                    </div>
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
