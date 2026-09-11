import { DEFAULT_HERO_SLIDES, HeroCarousel } from "./hero-carousel";

export interface HeroSectionProps {
  storeName?: string;
  tagline?: string;
  hotline?: string;
}

export function HeroSection({
  storeName = "Cửa hàng",
  tagline = "Hàng thiết yếu, đặt nhanh tại nhà",
  hotline: _hotline,
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
        <HeroCarousel slides={customSlides} />
      </div>
    </section>
  );
}
