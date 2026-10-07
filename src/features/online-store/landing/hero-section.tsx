import type { PreviewSlide } from "@/features/slider-preview/preview-slides";

import { DEFAULT_HERO_SLIDES } from "./hero-constants";
import { HeroCarousel } from "./hero-carousel";
import { ProductSlider } from "./product-slider";

export interface HeroSectionProps {
  storeName?: string;
  tagline?: string;
  hotline?: string;
  productSlides?: PreviewSlide[];
}

export function HeroSection({
  storeName = "Cửa hàng",
  tagline = "Hàng thiết yếu, đặt nhanh tại nhà",
  productSlides = [],
}: HeroSectionProps = {}) {
  const customSlides = [
    {
      ...DEFAULT_HERO_SLIDES[0],
      title: tagline,
      badge: `${storeName} • Mua sắm tiện lợi`,
    },
    ...DEFAULT_HERO_SLIDES.slice(1),
  ];

  return (
    <section className="relative overflow-hidden py-4 sm:py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {productSlides.length > 0 ? (
          <ProductSlider
            variant="spectra"
            slides={productSlides}
            storeName={storeName}
          />
        ) : (
          <HeroCarousel slides={customSlides} />
        )}
      </div>
    </section>
  );
}
