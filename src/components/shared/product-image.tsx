import { ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";

interface ProductImageProps {
  src?: string | null;
  alt: string;
  className?: string;
}

/**
 * Hien anh san pham tu URL ma khong phu thuoc danh sach remote host cua Next Image.
 * Anh la bo tro; khi URL hong, nen mau va icon van giu kich thuoc bo cuc on dinh.
 */
export function ProductImage({ src, alt, className }: ProductImageProps) {
  return (
    <span
      role={src ? "img" : undefined}
      aria-label={src ? alt : undefined}
      className={cn(
        "bg-muted text-muted-foreground relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl",
        className,
      )}
    >
      <ImageIcon aria-hidden="true" className="size-1/3" />
      {src ? (
        <span
          aria-hidden="true"
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${JSON.stringify(src)})` }}
        />
      ) : null}
    </span>
  );
}
