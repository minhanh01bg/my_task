"use client";

import { Check, PencilSimple, X } from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatVnd } from "@/lib/money";

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

  if (!editing) {
    return (
      <div className="flex min-w-[18rem] items-center justify-end gap-3">
        <div className="grid grid-cols-2 gap-x-5 text-right">
          <div>
            <p className="text-muted-foreground text-xs font-medium">Giá bán</p>
            <p className="font-bold tabular-nums">{formatVnd(product.price)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs font-medium">Tồn kho</p>
            <p
              className={
                product.stock < 0
                  ? "text-destructive font-bold tabular-nums"
                  : "font-bold tabular-nums"
              }
            >
              {product.stock} {product.unit}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-11 shrink-0"
          aria-label={`Sửa nhanh giá và tồn kho của ${product.name}`}
          onClick={() => {
            setMessage("");
            setEditing(true);
          }}
        >
          <PencilSimple aria-hidden="true" weight="bold" />
        </Button>
      </div>
    );
  }

  return (
    <form
      className="bg-muted/45 flex min-w-[24rem] items-end justify-end gap-2 rounded-2xl border p-2"
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
      <label className="grid gap-1 text-left text-xs font-bold">
        Giá bán
        <Input
          name="price"
          type="number"
          inputMode="numeric"
          min="0"
          step="100"
          defaultValue={product.price}
          className="bg-background h-11 w-28 text-right font-bold tabular-nums"
          aria-label={`Giá bán ${product.name}`}
          autoFocus
          required
        />
      </label>
      <label className="grid gap-1 text-left text-xs font-bold">
        Tồn kho
        <Input
          name="stock"
          type="number"
          inputMode="decimal"
          step="any"
          defaultValue={product.stock}
          className="bg-background h-11 w-24 text-right font-bold tabular-nums"
          aria-label={`Tồn kho ${product.name}`}
          required
        />
      </label>
      <Button
        type="submit"
        size="icon"
        className="size-11 shrink-0"
        disabled={saving}
        aria-label={`Lưu giá và tồn kho của ${product.name}`}
      >
        <Check aria-hidden="true" weight="bold" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="size-11 shrink-0"
        disabled={saving}
        aria-label="Hủy sửa nhanh"
        onClick={() => setEditing(false)}
      >
        <X aria-hidden="true" weight="bold" />
      </Button>
      {message ? (
        <span className="text-destructive sr-only">{message}</span>
      ) : null}
    </form>
  );
}
