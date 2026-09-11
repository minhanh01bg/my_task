import { HeroCarousel } from "./hero-carousel";

export interface HeroSectionProps {
  storeName?: string;
  tagline?: string;
  hotline?: string;
}

export function HeroSection({
  storeName: _storeName = "Cửa hàng",
  tagline: _tagline = "Hàng thiết yếu, đặt nhanh tại nhà",
  hotline: _hotline,
}: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden py-4 sm:py-6">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <HeroCarousel />
      </div>
    </section>
  );
}
