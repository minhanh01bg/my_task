"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle, Sparkle } from "@phosphor-icons/react";

import { NumberStepper } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ImageUploader } from "@/features/product-image/image-uploader";
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

  useEffect(() => {
    if (product) return;

    const draft = localStorage.getItem("an-phat-product-draft");
    if (!draft || !formRef.current) return;

    try {
      const values = JSON.parse(draft) as Record<string, string>;
      for (const element of formRef.current.elements) {
        if (
          element instanceof HTMLInputElement &&
          element.name &&
          values[element.name] !== undefined
        ) {
          element.value = values[element.name];
        }
      }
      const restoreState = window.setTimeout(() => {
        setCategoryId(values.categoryId ?? "");
        setUnit(values.unit ?? "cái");
        setImageUrl(values.imageUrl ?? "");
        setMessage("Đã khôi phục thông tin đang nhập dở");
      }, 0);

      return () => window.clearTimeout(restoreState);
    } catch {
      localStorage.removeItem("an-phat-product-draft");
    }
  }, [product]);

  function saveDraft(form: HTMLFormElement) {
    if (product) return;
    const draft: Record<string, string> = {};
    new FormData(form).forEach((value, key) => {
      if (typeof value === "string") draft[key] = value;
    });
    localStorage.setItem("an-phat-product-draft", JSON.stringify(draft));
  }

  async function handleAction(formData: FormData) {
    setIsSaving(true);
    setMessage(null);

    try {
      const result = await saveProductAction(formData);
      setMessage(result.ok ? "Đã lưu sản phẩm thành công" : result.message);

      if (result.ok && !product) {
        localStorage.removeItem("an-phat-product-draft");
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
          onInput={(event) => saveDraft(event.currentTarget)}
          onChange={(event) => saveDraft(event.currentTarget)}
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
            <Label htmlFor="product-price">Giá bán (VND)</Label>
            <NumberStepper
              id="product-price"
              name="price"
              min={0}
              step={1000}
              quickSteps={[1000, 5000, 10000, 50000, 100000]}
              defaultValue={product?.price ?? 0}
              isCurrency
              aria-label="Giá bán"
            />
            <p className="text-muted-foreground text-xs">
              Tăng giảm 1.000 đ/lần bấm. Nhấn Shift + mũi tên để nhảy 10.000 đ.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-stock">Số lượng đang có ({unit})</Label>
            <NumberStepper
              id="product-stock"
              name="stock"
              min={0}
              step={1}
              quickSteps={[1, 5, 10, 50]}
              defaultValue={product?.stock ?? 0}
              unit={unit}
              aria-label="Số lượng tồn kho"
            />
            <p className="text-muted-foreground text-xs">
              Đơn vị: {unit}. Có thể gõ trực tiếp số thập phân nếu cần.
            </p>
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
                <NumberStepper
                  id="product-cost-price"
                  name="costPrice"
                  min={0}
                  step={1000}
                  quickSteps={[1000, 5000, 10000, 50000]}
                  defaultValue={product?.costPrice ?? 0}
                  isCurrency
                  aria-label="Giá vốn"
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
                <Label>Ảnh sản phẩm</Label>
                <ImageUploader value={imageUrl} onChange={setImageUrl} />
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
