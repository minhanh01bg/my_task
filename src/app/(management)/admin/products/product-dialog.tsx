"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { CatalogCategory } from "@/types/catalog";

import { ProductForm, type ProductFormProps } from "./product-form";

export interface ProductDialogProps {
  categories: CatalogCategory[];
  product?: ProductFormProps["product"];
  defaultOpen?: boolean;
  trigger?: React.ReactNode;
}

export function ProductDialog({
  categories,
  product,
  defaultOpen = false,
  trigger,
}: ProductDialogProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [prevDefaultOpen, setPrevDefaultOpen] = useState(defaultOpen);
  const router = useRouter();

  if (defaultOpen !== prevDefaultOpen) {
    setPrevDefaultOpen(defaultOpen);
    setOpen(defaultOpen);
  }

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen && product) {
      // Khi đóng modal sửa sản phẩm, xóa param ?edit khỏi URL nếu có
      if (typeof window !== "undefined") {
        const url = new URL(window.location.href);
        if (url.searchParams.has("edit")) {
          url.searchParams.delete("edit");
          router.replace(url.pathname + (url.search ? url.search : ""));
        }
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          trigger ? (
            (trigger as React.ReactElement)
          ) : (
            <Button className="btn-press gap-2 font-bold shadow-sm">
              <Plus className="size-4" weight="bold" />
              <span>Thêm sản phẩm</span>
            </Button>
          )
        }
      />
      <DialogContent className="flex max-h-[90vh] w-full max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl lg:max-w-4xl">
        <DialogHeader className="border-border/60 shrink-0 border-b px-6 pt-6 pb-4 sm:px-8 sm:pt-7 sm:pb-5">
          <DialogTitle className="text-xl font-bold">
            {product ? `Sửa sản phẩm: ${product.name}` : "Thêm sản phẩm mới"}
          </DialogTitle>
          <DialogDescription>
            {product
              ? "Cập nhật giá, tồn kho và thông tin tìm kiếm cho sản phẩm."
              : "Nhập thông tin sản phẩm mới để bán tại quầy POS và hiển thị trên gian hàng trực tuyến."}
          </DialogDescription>
        </DialogHeader>
        <div className="modal-scroll flex-1 overflow-y-auto p-6 sm:p-8">
          <ProductForm
            categories={categories}
            product={product}
            isDialog={true}
            onSuccess={() => {
              handleOpenChange(false);
              router.refresh();
            }}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
