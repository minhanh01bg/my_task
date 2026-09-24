import type { Metadata } from "next";

type OpenGraph = NonNullable<Metadata["openGraph"]>;
type OpenGraphImage = {
  url: string;
  width?: number;
  height?: number;
  alt?: string;
};

/**
 * Ảnh OG mặc định do `src/app/opengraph-image.tsx` sinh. Trang tự khai báo
 * `openGraph` sẽ thay toàn bộ object của cha (kể cả ảnh file-based), nên
 * phải gắn lại ảnh này một cách tường minh.
 */
export const DEFAULT_OG_IMAGE: OpenGraphImage = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "Cửa hàng tạp hoá trực tuyến",
};

export interface StorefrontOpenGraphInput {
  title: string;
  description: string;
  /** URL canonical tuyệt đối. */
  url: string;
  siteName: string;
  images?: OpenGraphImage[];
}

export function storefrontOpenGraph({
  title,
  description,
  url,
  siteName,
  images,
}: StorefrontOpenGraphInput): OpenGraph {
  return {
    title,
    description,
    url,
    siteName,
    locale: "vi_VN",
    type: "website",
    images: images && images.length > 0 ? images : [DEFAULT_OG_IMAGE],
  };
}
