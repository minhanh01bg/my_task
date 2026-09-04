"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
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
    <form
      action={handleAction}
      className="grid grid-cols-2 gap-3 rounded-lg border p-4"
    >
      <label className="col-span-2 block">
        <span className="text-sm text-muted-foreground">Tên sản phẩm</span>
        <input
          name="name"
          required
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>

      <label className="col-span-2 block">
        <span className="text-sm text-muted-foreground">
          Tên gọi khác (ngăn cách bằng dấu phẩy) — giúp tìm nhanh hàng phụ
          tùng
        </span>
        <input
          name="aliases"
          placeholder="bugi wave, bugi thường"
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>

      <label className="block">
        <span className="text-sm text-muted-foreground">Mã nội bộ</span>
        <input
          name="sku"
          placeholder="PT-102"
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>

      <label className="block">
        <span className="text-sm text-muted-foreground">Danh mục</span>
        <select name="categoryId" className="mt-1 w-full rounded border px-3 py-2">
          <option value="">— Không —</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-sm text-muted-foreground">Đơn vị</span>
        <input
          name="unit"
          defaultValue="cái"
          required
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>

      <label className="block">
        <span className="text-sm text-muted-foreground">Tồn kho</span>
        <input
          name="stock"
          type="number"
          step="any"
          defaultValue="0"
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>

      <label className="block">
        <span className="text-sm text-muted-foreground">Giá bán (VND)</span>
        <input
          name="price"
          type="number"
          defaultValue="0"
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>

      <label className="block">
        <span className="text-sm text-muted-foreground">Giá vốn (VND)</span>
        <input
          name="costPrice"
          type="number"
          defaultValue="0"
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </label>

      <div className="col-span-2 flex items-center gap-3">
        <Button type="submit">Thêm sản phẩm</Button>
        {message ? (
          <span className="text-sm text-muted-foreground">{message}</span>
        ) : null}
      </div>
    </form>
  );
}
