import Image from "next/image";

import { avatarHue, initials } from "@/components/kit/avatar-color";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  src?: string | null;
  name: string;
  size?: number;
  className?: string;
}

/**
 * Phan lon san pham se chua co anh rat lau — nen anh du phong phai dep,
 * khong duoc la mot o xam trong.
 */
export function ProductImage({
  src,
  name,
  size = 64,
  className,
}: ProductImageProps) {
  if (src) {
    return (
      <Image
        src={src}
        alt={name}
        width={size}
        height={size}
        className={cn("bg-muted shrink-0 rounded-lg object-cover", className)}
      />
    );
  }

  const hue = avatarHue(name);

  return (
    <div
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        backgroundColor: `oklch(0.92 0.05 ${hue})`,
        color: `oklch(0.45 0.13 ${hue})`,
      }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg font-semibold",
        className,
      )}
    >
      {initials(name)}
    </div>
  );
}
