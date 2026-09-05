"use client";

import { useRef, useState } from "react";
import { CheckCircle, ImageSquare, Sparkle } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CatalogCategory } from "@/types/catalog";

import { saveProductAction } from "./actions";

interface ProductFormProps {
  categories: CatalogCategory[];
  product?: {
    id: string;
    name: string;
    aliases: string | null;
    sku: string | null;
    categoryId: string | null;
    unit: string;
    stock: number;
    price: number;
    costPrice: number;
    imageUrl: string | null;
  };
}

export function ProductForm({ categories, product }: ProductFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");
  const [unit, setUnit] = useState(product?.unit ?? "cái");
  const [isSaving, setIsSaving] = useState(false);

  async function handleAction(formData: FormData) {
    setIsSaving(true);
    setMessage(null);

    try {
      const result = await saveProductAction(formData);
      setMessage(result.ok ? "Đã lưu sản phẩm thành công" : result.message);

      if (result.ok && !product) {
        formRef.current?.reset();
        setImageUrl("");
        // Giữ lại danh mục và đơn vị để nhập liên tiếp nhiều mặt hàng cùng loại.
        requestAnimationFrame(() => nameRef.current?.focus());
      }
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {product ? `Sửa ${product.name}` : "Thêm sản phẩm"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form
          ref={formRef}
          action={handleAction}
          className="grid grid-cols-1 gap-5 sm:grid-cols-2"
        >
          {product ? (
            <input type="hidden" name="id" value={product.id} />
          ) : null}
          <div className="col-span-full space-y-1.5">
            <Label htmlFor="product-name">Tên sản phẩm</Label>
            <Input
              ref={nameRef}
              id="product-name"
              name="name"
              defaultValue={product?.name}
              placeholder="Ví dụ: Nước mắm Nam Ngư 750ml"
              className="h-12 text-base"
              autoFocus={!product}
              required
            />
          </div>

          <fieldset className="col-span-full space-y-2">
            <legend className="text-sm font-bold">Danh mục</legend>
            <p className="text-muted-foreground text-sm">
              Chạm một lần để chọn — hệ thống sẽ nhớ lựa chọn khi thêm món tiếp
              theo.
            </p>
            <input type="hidden" name="categoryId" value={categoryId} />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={categoryId === ""}
                onClick={() => setCategoryId("")}
                className="border-border bg-background hover:border-primary/40 hover:bg-primary/5 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground min-h-11 rounded-xl border px-4 text-sm font-semibold transition-colors"
              >
                Chưa phân loại
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  aria-pressed={categoryId === category.id}
                  onClick={() => setCategoryId(category.id)}
                  className="border-border bg-background hover:border-primary/40 hover:bg-primary/5 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground min-h-11 rounded-xl border px-4 text-sm font-semibold transition-colors"
                >
                  {category.name}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="col-span-full space-y-2">
            <Label htmlFor="product-unit">Đơn vị bán</Label>
            <div className="flex flex-wrap gap-2">
              {["cái", "gói", "chai", "lon", "hộp", "kg", "mét"].map(
                (suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    aria-pressed={unit === suggestion}
                    onClick={() => setUnit(suggestion)}
                    className="border-border bg-background hover:border-primary/40 aria-pressed:border-primary aria-pressed:bg-primary/10 aria-pressed:text-primary min-h-10 rounded-xl border px-3 text-sm font-semibold transition-colors"
                  >
                    {suggestion}
                  </button>
                ),
              )}
            </div>
            <Input
              id="product-unit"
              name="unit"
              value={unit}
              onChange={(event) => setUnit(event.target.value)}
              className="h-11 max-w-xs"
              aria-describedby="product-unit-help"
              required
            />
            <p id="product-unit-help" className="text-muted-foreground text-xs">
              Không có trong nút gợi ý thì gõ đơn vị khác vào ô trên.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-price">Giá bán</Label>
            <Input
              id="product-price"
              name="price"
              type="number"
              inputMode="numeric"
              min="0"
              defaultValue={product?.price ?? 0}
              className="h-12 text-lg font-bold tabular-nums"
            />
            <p className="text-muted-foreground text-xs">Đơn vị: đồng (VND)</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-stock">Số lượng đang có</Label>
            <Input
              id="product-stock"
              name="stock"
              type="number"
              inputMode="decimal"
              step="any"
              defaultValue={product?.stock ?? 0}
              className="h-12 text-lg font-bold tabular-nums"
            />
          </div>

          <details className="border-border bg-muted/35 col-span-full rounded-2xl border p-4 open:pb-5">
            <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 font-bold">
              <Sparkle aria-hidden="true" className="text-primary size-5" />
              Thông tin thêm
              <span className="text-muted-foreground ml-1 text-sm font-normal">
                (không bắt buộc)
              </span>
            </summary>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="product-cost-price">Giá vốn (VND)</Label>
                <Input
                  id="product-cost-price"
                  name="costPrice"
                  type="number"
                  inputMode="numeric"
                  min="0"
                  defaultValue={product?.costPrice ?? 0}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="product-sku">Mã nội bộ</Label>
                <Input
                  id="product-sku"
                  name="sku"
                  defaultValue={product?.sku ?? ""}
                  placeholder="Ví dụ: PT-102"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="product-aliases">Tên gọi khác</Label>
                <Input
                  id="product-aliases"
                  name="aliases"
                  defaultValue={product?.aliases ?? ""}
                  placeholder="Ví dụ: bugi wave, bugi thường"
                />
                <p className="text-muted-foreground text-xs">
                  Ngăn cách bằng dấu phẩy để tìm sản phẩm bằng tên quen gọi.
                </p>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="product-image-url">Ảnh sản phẩm</Label>
                <div className="flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="bg-background text-muted-foreground border-border flex size-16 shrink-0 items-center justify-center rounded-xl border bg-cover bg-center"
                    style={
                      imageUrl
                        ? {
                            backgroundImage: `url(${JSON.stringify(imageUrl)})`,
                          }
                        : undefined
                    }
                  >
                    {!imageUrl ? <ImageSquare className="size-6" /> : null}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Input
                      id="product-image-url"
                      name="imageUrl"
                      type="url"
                      value={imageUrl}
                      onChange={(event) => setImageUrl(event.target.value)}
                      placeholder="Dán đường dẫn ảnh nếu có"
                    />
                    <p className="text-muted-foreground mt-1 text-xs">
                      Có thể bỏ qua và bổ sung ảnh sau.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </details>

          <div className="col-span-full flex flex-wrap items-center gap-3">
            <Button type="submit" size="lg" disabled={isSaving}>
              {isSaving
                ? "Đang lưu…"
                : product
                  ? "Lưu thay đổi"
                  : "Lưu và nhập món tiếp"}
            </Button>
            {message ? (
              <span
                className="text-primary flex items-center gap-1.5 text-sm font-semibold"
                role="status"
              >
                <CheckCircle aria-hidden="true" weight="fill" />
                {message}
              </span>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
