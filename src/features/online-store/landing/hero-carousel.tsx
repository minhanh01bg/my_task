"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

import { DEFAULT_HERO_SLIDES, type HeroSlide } from "./hero-constants";

export { DEFAULT_HERO_SLIDES, type HeroSlide };

export interface HeroCarouselProps {
  slides?: HeroSlide[];
  autoPlayInterval?: number;
}

export function HeroCarousel({
  slides = DEFAULT_HERO_SLIDES,
  autoPlayInterval = 5000,
}: HeroCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  const total = slides.length;

  const nextSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const prevSlide = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  useEffect(() => {
    if (isPaused || autoPlayInterval <= 0) return;

    const timer = setInterval(() => {
      nextSlide();
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [isPaused, autoPlayInterval, nextSlide]);

  const currentSlide = slides[currentIndex];

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX - touchEndX;

    if (diff > 50) {
      nextSlide();
    } else if (diff < -50) {
      prevSlide();
    }
    setTouchStartX(null);
  };

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label="Khuyến mãi nổi bật"
      className="surface-panel relative overflow-hidden rounded-3xl"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Gradient */}
      <div
        className={`absolute inset-0 bg-gradient-to-br transition-all duration-700 ${currentSlide.gradient ?? "from-primary/10 to-transparent"}`}
      />

      {/* Decorative ambient lighting */}
      <div className="bg-primary/10 pointer-events-none absolute -top-24 -right-24 size-96 rounded-full blur-3xl" />

      {/* Slide Content */}
      <div className="relative z-10 px-6 py-12 sm:px-12 sm:py-16 md:py-20">
        <div className="max-w-2xl">
          <Badge
            variant="outline"
            className="border-primary/20 bg-primary/10 text-primary animate-pulse-subtle gap-1.5 rounded-full px-3.5 py-1 text-xs font-semibold"
          >
            <Sparkles className="size-3.5" />
            <span>{currentSlide.badge}</span>
          </Badge>

          <h1 className="font-heading text-foreground mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
            {currentSlide.title}
          </h1>

          <p className="text-muted-foreground mt-4 text-base leading-relaxed sm:text-lg">
            {currentSlide.description}
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href={currentSlide.ctaHref}
              className={buttonVariants({
                size: "lg",
                className:
                  "btn-press gap-2 rounded-xl px-6 text-base font-bold shadow-md",
              })}
            >
              <span>{currentSlide.ctaText}</span>
              <ArrowRight className="size-4" />
            </Link>

            {currentSlide.secondaryText && currentSlide.secondaryHref ? (
              <Link
                href={currentSlide.secondaryHref}
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className:
                    "btn-press rounded-xl px-5 text-base font-semibold",
                })}
              >
                {currentSlide.secondaryText}
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      {/* Controls: Prev / Next */}
      <button
        type="button"
        onClick={prevSlide}
        aria-label="Slide trước đó"
        className="bg-background/80 text-foreground hover:bg-background absolute top-1/2 left-3 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full shadow-md backdrop-blur-sm transition-all hover:scale-105"
      >
        <ChevronLeft className="size-5" />
      </button>

      <button
        type="button"
        onClick={nextSlide}
        aria-label="Slide tiếp theo"
        className="bg-background/80 text-foreground hover:bg-background absolute top-1/2 right-3 z-20 flex size-10 -translate-y-1/2 items-center justify-center rounded-full shadow-md backdrop-blur-sm transition-all hover:scale-105"
      >
        <ChevronRight className="size-5" />
      </button>

      {/* Pagination Dots */}
      <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2">
        {slides.map((slide, index) => {
          const isActive = index === currentIndex;
          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => goToSlide(index)}
              aria-label={`Chuyển tới slide ${index + 1}`}
              aria-current={isActive ? "true" : "false"}
              className={`rounded-full transition-all duration-300 ${
                isActive
                  ? "bg-primary h-2.5 w-7"
                  : "bg-muted-foreground/40 hover:bg-muted-foreground/70 size-2.5"
              }`}
            />
          );
        })}
      </div>
    </div>
  );
}
