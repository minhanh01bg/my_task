import {
  DataTableShell,
  EmptyState,
  Money,
  PageHeader,
  ProductImage,
  StockBadge,
} from "@/components/kit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
      <PageHeader
        title="Sản phẩm"
        description="Hàng hoá đang bán tại quầy. Sửa ở đây là màn bán hàng đổi theo."
      />

      <ProductForm categories={categories} />

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
    </div>
  );
}
