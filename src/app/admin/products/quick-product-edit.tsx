"use client";

import { Check, PencilSimple, X } from "@phosphor-icons/react";
import { useState } from "react";

import { NumberStepper } from "@/components/kit";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { quickUpdateProductAction } from "./actions";

interface QuickProductEditProps {
  product: {
    id: string;
    name: string;
    price: number;
    stock: number;
    unit: string;
  };
}

export function QuickProductEdit({ product }: QuickProductEditProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <Dialog open={editing} onOpenChange={setEditing}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-11 shrink-0"
            aria-label={`Sửa nhanh giá và tồn kho của ${product.name}`}
          />
        }
      >
        <PencilSimple aria-hidden="true" weight="bold" />
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sửa nhanh {product.name}</DialogTitle>
          <DialogDescription>
            Chỉ cập nhật giá bán và số lượng đang có trong cửa hàng.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid gap-4"
          action={async (formData) => {
            setSaving(true);
            setMessage("");
            const result = await quickUpdateProductAction(formData);
            setSaving(false);
            if (result.ok) {
              setEditing(false);
              return;
            }
            setMessage(result.message);
          }}
        >
          <input type="hidden" name="id" value={product.id} />
          <div className="grid gap-1.5">
            <span className="text-sm font-bold">Giá bán (VND)</span>
            <NumberStepper
              name="price"
              min={0}
              step={1000}
              quickSteps={[1000, 5000, 10000, 50000]}
              defaultValue={product.price}
              isCurrency
              autoFocus
              required
              aria-label="Giá bán"
            />
          </div>
          <div className="grid gap-1.5">
            <span className="text-sm font-bold">Tồn kho ({product.unit})</span>
            <NumberStepper
              name="stock"
              allowNegative
              allowDecimal
              step={1}
              quickSteps={[1, 5, 10, 50]}
              defaultValue={product.stock}
              unit={product.unit}
              required
              aria-label={`Tồn kho ${product.unit}`}
            />
          </div>
          {message ? (
            <p role="alert" className="text-destructive text-sm font-semibold">
              {message}
            </p>
          ) : null}
          <div className="flex gap-2 pt-2">
            <Button type="submit" className="min-h-11 flex-1" disabled={saving}>
              <Check aria-hidden="true" weight="bold" />
              {saving ? "Đang lưu…" : "Lưu thay đổi"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={saving}
              onClick={() => setEditing(false)}
            >
              <X aria-hidden="true" weight="bold" /> Hủy
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
