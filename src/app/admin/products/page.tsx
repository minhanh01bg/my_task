import Link from "next/link";
import { NotePencil, Trash, Warning } from "@phosphor-icons/react/dist/ssr";

import { Pagination } from "@/components/kit";
import { ConfirmAction } from "@/components/shared/confirm-action";
import { ProductImage } from "@/components/shared/product-image";
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
import {
  findEditableProduct,
  isProductStockStatus,
  listProductCategories,
  listProducts,
} from "@/server/admin/list-products";
import { parsePageParam } from "@/server/admin/pagination";

import { ProductDialog } from "./product-dialog";
import { ProductFilters } from "./product-filters";
import { QuickProductEdit } from "./quick-product-edit";
import { deleteProductAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    edit?: string;
    lowStock?: string;
    status?: string;
    categoryId?: string;
    page?: string;
  }>;
}) {
  const {
    q = "",
    edit,
    lowStock,
    status,
    categoryId,
    page: pageParam,
  } = await searchParams;

  // Xử lý trạng thái lọc
  const effectiveStatus =
    lowStock === "true" ? "low" : isProductStockStatus(status) ? status : "all";

  const [categories, productPage, editingProduct] = await Promise.all([
    listProductCategories(),
    listProducts({
      page: parsePageParam(pageParam),
      q,
      filters: { categoryId, status: effectiveStatus },
    }),
    edit ? findEditableProduct(edit) : null,
  ]);

  const { items: products, total, page, pageSize, counts } = productPage;
  // Thống kê tồn kho theo các nhóm (đếm theo từ khóa tìm kiếm)
  const lowStockCount = counts.low;

  return (
    <div className="space-y-6">
      {/* Header with Title and Add Product Button */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="eyebrow">Danh mục hàng hóa</p>
          <h1 className="font-heading mt-1 text-3xl font-bold">Sản phẩm</h1>
          <p className="text-muted-foreground mt-1">
            Quản lý giá, tồn kho, phân loại danh mục và cảnh báo nhập hàng.
          </p>
        </div>

        {/* Modal Thêm / Sửa sản phẩm */}
        <ProductDialog
          categories={categories}
          product={editingProduct ?? undefined}
          defaultOpen={Boolean(editingProduct)}
        />
      </div>

      {/* Low stock alert banner */}
      {lowStockCount > 0 ? (
        <div
          data-testid="low-stock-alert"
          className="surface-panel flex flex-col items-start justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-900 sm:flex-row sm:items-center dark:text-amber-200"
        >
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-500/20 p-2 text-amber-600 dark:text-amber-400">
              <Warning className="size-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold">
                Cảnh báo tồn kho thấp ({lowStockCount} mặt hàng)
              </h4>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Các sản phẩm còn từ 5 đơn vị trở xuống cần được lên kế hoạch
                nhập hàng sớm.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {effectiveStatus === "low" ? (
              <Link
                href={`/admin/products${q ? `?q=${encodeURIComponent(q)}` : ""}`}
                className="text-primary bg-background rounded-lg border px-3 py-1.5 text-xs font-bold hover:underline"
              >
                Hiện tất cả ({counts.all})
              </Link>
            ) : (
              <Link
                href={`/admin/products?status=low${q ? `&q=${encodeURIComponent(q)}` : ""}${categoryId ? `&categoryId=${encodeURIComponent(categoryId)}` : ""}`}
                className="rounded-lg border border-amber-500/30 bg-amber-500/20 px-3 py-1.5 text-xs font-bold text-amber-800 hover:underline dark:text-amber-300"
              >
                Lọc hàng sắp hết ({lowStockCount})
              </Link>
            )}
          </div>
        </div>
      ) : null}

      {/* Product Filters Toolbar (Stock Status Tabs, Search, Category Dropdown) */}
      <ProductFilters
        categories={categories}
        currentQuery={q}
        currentCategoryId={categoryId}
        currentStatus={effectiveStatus}
        counts={counts}
      />

      {/* Product List Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Danh sách ({total}
            {total !== counts.all ? ` / ${counts.all}` : ""})
          </CardTitle>
          {total !== counts.all ? (
            <span className="text-muted-foreground text-xs font-medium">
              Đang áp dụng bộ lọc
            </span>
          ) : null}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Sản phẩm</TableHead>
                <TableHead>Danh mục</TableHead>
                <TableHead className="text-right">Giá bán</TableHead>
                <TableHead className="text-right">Tồn</TableHead>
                <TableHead className="text-right">
                  <span className="sr-only">Thao tác</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-muted-foreground py-8 text-center text-sm"
                  >
                    Không tìm thấy sản phẩm nào khớp với điều kiện lọc.
                  </TableCell>
                </TableRow>
              ) : (
                products.map((product) => (
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
                    <TableCell className="text-right font-bold tabular-nums">
                      {formatVnd(product.price)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {product.stock < 0 ? (
                        <Badge variant="destructive">
                          {product.stock} {product.unit}
                        </Badge>
                      ) : product.stock === 0 ? (
                        <Badge
                          variant="destructive"
                          className="border-red-500/30 bg-red-500/15 text-red-700 dark:text-red-300"
                        >
                          Hết hàng ({product.stock} {product.unit})
                        </Badge>
                      ) : product.stock <= 5 ? (
                        <Badge
                          variant="outline"
                          className="border-amber-500/30 bg-amber-500/15 text-amber-800 dark:text-amber-200"
                        >
                          {product.stock} {product.unit}
                        </Badge>
                      ) : (
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {product.stock} {product.unit}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-2">
                        <QuickProductEdit product={product} />

                        {/* Dialog sửa chi tiết sản phẩm */}
                        <ProductDialog
                          categories={categories}
                          product={product}
                          trigger={
                            <Button
                              variant="outline"
                              size="icon"
                              className="size-11"
                              aria-label={`Sửa ${product.name}`}
                            >
                              <NotePencil aria-hidden="true" weight="bold" />
                            </Button>
                          }
                        />

                        <ConfirmAction
                          action={deleteProductAction.bind(null, product.id)}
                          triggerLabel="Xóa"
                          triggerIcon={
                            <Trash aria-hidden="true" weight="bold" />
                          }
                          triggerAriaLabel={`Ngừng bán ${product.name}`}
                          title={`Ngừng bán “${product.name}”?`}
                          description="Sản phẩm sẽ không còn xuất hiện tại quầy bán hàng. Các đơn hàng cũ vẫn được giữ nguyên để tra cứu."
                          confirmLabel="Ngừng bán sản phẩm"
                          triggerVariant="outline"
                          triggerClassName="border-destructive/20 text-destructive hover:border-destructive/40 hover:bg-destructive/10"
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <Pagination
            pathname="/admin/products"
            label="Phân trang sản phẩm"
            page={page}
            pageSize={pageSize}
            total={total}
            searchParams={{ q, status, lowStock, categoryId }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
