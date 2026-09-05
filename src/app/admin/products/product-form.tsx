"use client";

import { useState } from "react";
import { ImagePlus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  const [message, setMessage] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState(product?.imageUrl ?? "");

  async function handleAction(formData: FormData) {
    const result = await saveProductAction(formData);
    setMessage(result.ok ? "Đã lưu" : result.message);
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
          action={handleAction}
          className="grid grid-cols-1 gap-4 sm:grid-cols-2"
        >
          {product ? (
            <input type="hidden" name="id" value={product.id} />
          ) : null}
          <div className="col-span-full space-y-1.5">
            <Label htmlFor="product-name">Tên sản phẩm</Label>
            <Input
              id="product-name"
              name="name"
              defaultValue={product?.name}
              required
            />
          </div>

          <div className="col-span-full space-y-1.5">
            <Label htmlFor="product-image-url">Ảnh sản phẩm</Label>
            <div className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="bg-muted text-muted-foreground flex size-16 shrink-0 items-center justify-center rounded-xl bg-cover bg-center"
                style={
                  imageUrl
                    ? { backgroundImage: `url(${JSON.stringify(imageUrl)})` }
                    : undefined
                }
              >
                {!imageUrl ? <ImagePlus className="size-6" /> : null}
              </span>
              <div className="min-w-0 flex-1">
                <Input
                  id="product-image-url"
                  name="imageUrl"
                  type="url"
                  value={imageUrl}
                  onChange={(event) => setImageUrl(event.target.value)}
                  placeholder="https://example.com/san-pham.jpg"
                />
                <p className="text-muted-foreground mt-1 text-xs">
                  Dán đường dẫn ảnh công khai. Nên dùng ảnh vuông, nền sáng.
                </p>
              </div>
            </div>
          </div>

          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="product-aliases">
              Tên gọi khác (ngăn cách bằng dấu phẩy) — giúp tìm nhanh hàng phụ
              tùng
            </Label>
            <Input
              id="product-aliases"
              name="aliases"
              defaultValue={product?.aliases ?? ""}
              placeholder="bugi wave, bugi thường"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-sku">Mã nội bộ</Label>
            <Input
              id="product-sku"
              name="sku"
              defaultValue={product?.sku ?? ""}
              placeholder="PT-102"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-category">Danh mục</Label>
            <Select
              name="categoryId"
              defaultValue={product?.categoryId ?? undefined}
            >
              <SelectTrigger id="product-category" className="w-full">
                <SelectValue placeholder="— Không —" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-unit">Đơn vị</Label>
            <Input
              id="product-unit"
              name="unit"
              defaultValue={product?.unit ?? "cái"}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-stock">Tồn kho</Label>
            <Input
              id="product-stock"
              name="stock"
              type="number"
              step="any"
              defaultValue={product?.stock ?? 0}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-price">Giá bán (VND)</Label>
            <Input
              id="product-price"
              name="price"
              type="number"
              defaultValue={product?.price ?? 0}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product-cost-price">Giá vốn (VND)</Label>
            <Input
              id="product-cost-price"
              name="costPrice"
              type="number"
              defaultValue={product?.costPrice ?? 0}
            />
          </div>

          <div className="col-span-full flex items-center gap-3">
            <Button type="submit">
              {product ? "Lưu thay đổi" : "Thêm sản phẩm"}
            </Button>
            {message ? (
              <span className="text-muted-foreground text-sm">{message}</span>
            ) : null}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
