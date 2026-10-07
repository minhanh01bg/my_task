export const PREVIEW_VARIANTS = [
  {
    id: "spectra",
    name: "Spectra",
    number: "01",
    note: "Chiều sâu · Ánh sáng · Sản phẩm làm trung tâm",
    reference: "https://www.getlayers.ai/layer/slider-spectra",
  },
  {
    id: "spotlight",
    name: "Spotlight",
    number: "02",
    note: "Sáng · Thanh lịch · Khoảng thở",
    reference: "https://www.getlayers.ai/layer/carousel-spotlight",
  },
  {
    id: "under-the-radar",
    name: "Under The Radar",
    number: "03",
    note: "Chữ lớn · Ảnh xòe · Cá tính",
    reference: "https://www.getlayers.ai/layer/carousel-under-the-radar",
  },
] as const;

export type PreviewVariant = (typeof PREVIEW_VARIANTS)[number]["id"];

export function isPreviewVariant(value: string): value is PreviewVariant {
  return PREVIEW_VARIANTS.some((variant) => variant.id === value);
}
