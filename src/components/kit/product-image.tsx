import { avatarHue, initials } from "@/components/kit/avatar-color";
import { cn } from "@/lib/utils";

interface ProductImageProps {
  src?: string | null;
  /** Ten san pham: sinh chu cai dau va mau cho anh du phong. */
  name: string;
  /** Mo ta cho trinh doc man hinh; mac dinh la ten san pham. */
  alt?: string;
  /** Canh vuong co dinh (px). Bo trong de className quyet dinh kich thuoc. */
  size?: number;
  className?: string;
}

/**
 * Anh san pham duy nhat cho ca POS lan admin.
 *
 * - Dung URL goc (khong qua /_next/image) de service worker cua POS cache
 *   duoc /uploads/* khi mat mang, va khong phu thuoc danh sach remote host.
 * - Phan lon san pham se chua co anh rat lau — nen anh du phong phai dep,
 *   khong duoc la mot o xam trong.
 */
export function ProductImage({
  src,
  name,
  alt,
  size,
  className,
}: ProductImageProps) {
  const box = size ? { width: size, height: size } : undefined;

  if (src) {
    return (
      <span
        role="img"
        aria-label={alt ?? name}
        style={{ ...box, backgroundImage: `url(${JSON.stringify(src)})` }}
        className={cn(
          "bg-muted block shrink-0 overflow-hidden rounded-lg bg-cover bg-center bg-no-repeat",
          className,
        )}
      />
    );
  }

  const hue = avatarHue(name);

  return (
    <span
      aria-hidden="true"
      style={{
        ...box,
        backgroundColor: `oklch(0.92 0.05 ${hue})`,
        color: `oklch(0.45 0.13 ${hue})`,
      }}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg font-semibold",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
