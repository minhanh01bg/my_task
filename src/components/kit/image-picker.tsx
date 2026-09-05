"use client";

import { useEffect, useState } from "react";

import { ProductImage } from "@/components/kit/product-image";
import { Input } from "@/components/ui/input";

interface ImagePickerProps {
  name: string;
  productName: string;
  currentUrl?: string | null;
}

/**
 * Xem truoc bang object URL ngay tren may — chu quan thay minh chon dung anh
 * chua truoc khi bam luu, khong phai luu roi moi biet.
 */
export function ImagePicker({
  name,
  productName,
  currentUrl,
}: ImagePickerProps) {
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    // Object URL giu bo nho cho den khi duoc thu hoi.
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setPreview((old) => {
      if (old) URL.revokeObjectURL(old);
      return file ? URL.createObjectURL(file) : null;
    });
  }

  return (
    <div className="flex items-center gap-4">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element -- object URL, khong qua next/image duoc
        <img
          src={preview}
          alt="Xem trước"
          width={64}
          height={64}
          className="size-16 shrink-0 rounded-lg object-cover"
        />
      ) : (
        <ProductImage src={currentUrl} name={productName} size={64} />
      )}

      <Input
        type="file"
        name={name}
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        className="max-w-xs"
      />
    </div>
  );
}
