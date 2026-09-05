"use client";

import { useRef, useState } from "react";
import {
  Camera,
  ImageSquare,
  SpinnerGap,
  UploadSimple,
} from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";

interface ImageUploaderProps {
  value: string;
  onChange: (value: string) => void;
}

export function ImageUploader({ value, onChange }: ImageUploaderProps) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState(value);
  const [status, setStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  async function upload(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("Tệp đã chọn không phải là ảnh.");
      return;
    }

    const localPreview = URL.createObjectURL(file);
    setPreview(localPreview);
    setUploading(true);
    setStatus("Đang tải ảnh lên…");

    try {
      const body = new FormData();
      body.set("image", file);
      const response = await fetch("/api/products/images", {
        method: "POST",
        body,
      });
      const result = (await response.json()) as {
        ok: boolean;
        url?: string;
        message?: string;
      };

      if (!response.ok || !result.ok || !result.url) {
        setStatus(result.message ?? "Không tải được ảnh. Vui lòng thử lại.");
        return;
      }

      onChange(result.url);
      setPreview(result.url);
      setStatus("Ảnh đã sẵn sàng để lưu cùng sản phẩm.");
    } catch {
      setStatus("Mất kết nối khi tải ảnh. Vui lòng thử lại.");
    } finally {
      URL.revokeObjectURL(localPreview);
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <span className="bg-background text-muted-foreground border-border flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border shadow-sm">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh do người dùng tải lên, URL động cùng origin
          <img
            src={preview}
            alt="Ảnh sản phẩm xem trước"
            className="size-full object-cover"
          />
        ) : (
          <ImageSquare aria-hidden="true" className="size-8" />
        )}
      </span>

      <div className="flex-1 space-y-2">
        <input type="hidden" name="imageUrl" value={value} />
        <input
          ref={galleryRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="sr-only"
          onChange={(event) => void upload(event.target.files?.[0])}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => void upload(event.target.files?.[0])}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => galleryRef.current?.click()}
          >
            {uploading ? (
              <SpinnerGap className="animate-spin" />
            ) : (
              <UploadSimple />
            )}
            Chọn ảnh
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            onClick={() => cameraRef.current?.click()}
          >
            <Camera /> Chụp ảnh
          </Button>
          {value ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onChange("");
                setPreview("");
                setStatus("Đã bỏ ảnh khỏi sản phẩm.");
              }}
            >
              Bỏ ảnh
            </Button>
          ) : null}
        </div>
        <p className="text-muted-foreground text-xs">
          Trên điện thoại, chọn “Chụp ảnh” để mở camera sau. Tối đa 8 MB.
        </p>
        {status ? (
          <p className="text-primary text-sm font-semibold" role="status">
            {status}
          </p>
        ) : null}
      </div>
    </div>
  );
}
