"use client";

import { useState } from "react";

import {
  CollapsibleFormCard,
  ImagePicker,
  TouchButton,
} from "@/components/kit";
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
}

export function ProductForm({ categories }: ProductFormProps) {
  const [message, setMessage] = useState<string | null>(null);

  async function handleAction(formData: FormData) {
    const result = await saveProductAction(formData);
    setMessage(result.ok ? "Đã lưu" : result.message);
  }

  return (
    <CollapsibleFormCard title="Thêm sản phẩm" triggerLabel="Thêm sản phẩm">
      <form action={handleAction} className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="product-name">Tên sản phẩm</Label>
          <Input id="product-name" name="name" required />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="product-aliases">
            Tên gọi khác (ngăn cách bằng dấu phẩy) — giúp tìm nhanh hàng phụ
            tùng
          </Label>
          <Input
            id="product-aliases"
            name="aliases"
            placeholder="bugi wave, bugi thường"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="product-sku">Mã nội bộ</Label>
          <Input id="product-sku" name="sku" placeholder="PT-102" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="product-category">Danh mục</Label>
          <Select name="categoryId">
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
          <Input id="product-unit" name="unit" defaultValue="cái" required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="product-stock">Tồn kho</Label>
          <Input
            id="product-stock"
            name="stock"
            type="number"
            step="any"
            defaultValue="0"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="product-price">Giá bán (VND)</Label>
          <Input
            id="product-price"
            name="price"
            type="number"
            defaultValue="0"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="product-cost-price">Giá vốn (VND)</Label>
          <Input
            id="product-cost-price"
            name="costPrice"
            type="number"
            defaultValue="0"
          />
        </div>

        <div className="col-span-2 space-y-1.5">
          <Label htmlFor="product-image">Ảnh sản phẩm</Label>
          <ImagePicker name="image" productName="Sản phẩm" currentUrl={null} />
        </div>

        <div className="col-span-2 flex items-center gap-3">
          <TouchButton type="submit">Lưu sản phẩm</TouchButton>
          {message ? (
            <span
              className={
                message === "Đã lưu"
                  ? "text-success text-sm font-medium"
                  : "text-destructive text-sm font-medium"
              }
            >
              {message}
            </span>
          ) : null}
        </div>
      </form>
    </CollapsibleFormCard>
  );
}
