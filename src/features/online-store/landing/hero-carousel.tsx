"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Leaf,
  Pause,
  Play,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import {
  DEFAULT_HERO_SLIDES,
  type HeroSlide,
  type HeroSlideVisual,
} from "./hero-constants";

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
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animKey, setAnimKey] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startXRef = useRef<number | null>(null);
  const hasMovedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef(0);
  const isHoveredRef = useRef(false);
  const transitionTimerRef = useRef<NodeJS.Timeout | null>(null);

  const total = slides.length;

  const changeSlide = useCallback(
    (newIndex: number, dir: 1 | -1) => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
      setPrevIndex(currentIndex);
      setDirection(dir);
      setCurrentIndex(newIndex);
      setIsAnimating(true);
      setAnimKey((k) => k + 1);

      transitionTimerRef.current = setTimeout(() => {
        setIsAnimating(false);
        setPrevIndex(null);
      }, 550);
    },
    [currentIndex],
  );

  const nextSlide = useCallback(() => {
    changeSlide((currentIndex + 1) % total, 1);
  }, [changeSlide, currentIndex, total]);

  const prevSlide = useCallback(() => {
    changeSlide((currentIndex - 1 + total) % total, -1);
  }, [changeSlide, currentIndex, total]);

  const goToSlide = (index: number) => {
    if (index === currentIndex) return;
    changeSlide(index, index > currentIndex ? 1 : -1);
  };

  // Cleanup transition timer on unmount
  useEffect(() => {
    return () => {
      if (transitionTimerRef.current) {
        clearTimeout(transitionTimerRef.current);
      }
    };
  }, []);

  // Autoplay
  useEffect(() => {
    if (isPaused || autoPlayInterval <= 0) return;

    const timer = setInterval(() => {
      nextSlide();
    }, autoPlayInterval);

    return () => clearInterval(timer);
  }, [isPaused, autoPlayInterval, nextSlide]);

  // Touch and Mouse Drag handlers
  const handleStart = (clientX: number) => {
    setIsPaused(true);
    setIsDragging(true);
    startXRef.current = clientX;
    hasMovedRef.current = false;
    dragOffsetRef.current = 0;
    setDragOffset(0);
  };

  const handleMove = (clientX: number) => {
    if (startXRef.current === null) return;
    const diff = clientX - startXRef.current;
    if (Math.abs(diff) > 5) {
      hasMovedRef.current = true;
    }
    dragOffsetRef.current = diff;
    setDragOffset(diff);
  };

  const handleEnd = () => {
    const finalOffset = dragOffsetRef.current;
    if (startXRef.current !== null) {
      if (finalOffset < -50) {
        nextSlide();
      } else if (finalOffset > 50) {
        prevSlide();
      }
    }
    setIsDragging(false);
    dragOffsetRef.current = 0;
    setDragOffset(0);
    startXRef.current = null;
    if (!isHoveredRef.current) {
      setIsPaused(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      prevSlide();
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      nextSlide();
    } else if (e.key === " ") {
      e.preventDefault();
      setIsPaused((p) => !p);
    }
  };

  return (
    <div
      ref={containerRef}
      role="region"
      aria-roledescription="carousel"
      aria-label="Khuyến mãi nổi bật"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onMouseEnter={() => {
        isHoveredRef.current = true;
        setIsPaused(true);
      }}
      onMouseLeave={() => {
        isHoveredRef.current = false;
        if (!isDragging) setIsPaused(false);
      }}
      onTouchStart={(e) => handleStart(e.touches[0].clientX)}
      onTouchMove={(e) => handleMove(e.touches[0].clientX)}
      onTouchEnd={handleEnd}
      onMouseDown={(e) => handleStart(e.clientX)}
      onMouseMove={(e) => {
        if (isDragging) handleMove(e.clientX);
      }}
      onMouseUp={handleEnd}
      onClickCapture={(e) => {
        if (hasMovedRef.current) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className="border-border/60 shadow-primary/5 focus-visible:ring-primary/40 group from-card to-background relative touch-pan-y overflow-hidden rounded-3xl border bg-gradient-to-br shadow-xl transition-all duration-500 select-none focus-visible:ring-2 focus-visible:outline-none"
    >
      {/* Background dynamic ambient gradients (silky smooth cross-dissolve) */}
      {slides.map((slide, idx) => (
        <div
          key={slide.id}
          className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${
            slide.gradient ?? "from-primary/15 to-transparent"
          } transition-opacity duration-700 ease-in-out ${
            idx === currentIndex ? "opacity-100" : "opacity-0"
          }`}
        />
      ))}

      {/* Decorative ambient lighting orbs with subtle floating motion */}
      <div className="bg-primary/20 pointer-events-none absolute -top-24 -right-24 size-96 transform-gpu rounded-full blur-3xl will-change-transform" />
      <div className="bg-accent/15 pointer-events-none absolute -bottom-24 -left-24 size-80 transform-gpu rounded-full blur-3xl will-change-transform" />

      {/* Subtle tech dot overlay */}
      <div className="from-foreground/5 pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] via-transparent to-transparent opacity-40" />

      {/* Slides Horizontal Container with True Circular Seamless Motion */}
      <div className="relative grid w-full grid-cols-1 grid-rows-1 select-none">
        {slides.map((slide, index) => {
          const isActive = index === currentIndex;
          const isEntering = isAnimating && index === currentIndex;
          const isExiting = isAnimating && index === prevIndex;

          let animationClass = "";
          let isVisible = false;

          if (isDragging) {
            if (isActive) {
              isVisible = true;
            } else if (dragOffset < 0 && index === (currentIndex + 1) % total) {
              isVisible = true;
            } else if (
              dragOffset > 0 &&
              index === (currentIndex - 1 + total) % total
            ) {
              isVisible = true;
            }
          } else if (isAnimating) {
            if (isEntering) {
              isVisible = true;
              animationClass =
                direction === 1
                  ? "animate-carousel-slide-in-right z-10"
                  : "animate-carousel-slide-in-left z-10";
            } else if (isExiting) {
              isVisible = true;
              animationClass =
                direction === 1
                  ? "animate-carousel-slide-out-left z-0"
                  : "animate-carousel-slide-out-right z-0";
            }
          } else {
            if (isActive) {
              isVisible = true;
            }
          }

          const dragStyle: React.CSSProperties | undefined = isDragging
            ? {
                transform:
                  index === currentIndex
                    ? `translate3d(${dragOffset}px, 0, 0)`
                    : dragOffset < 0 && index === (currentIndex + 1) % total
                      ? `translate3d(calc(100% + ${dragOffset}px), 0, 0)`
                      : dragOffset > 0 &&
                          index === (currentIndex - 1 + total) % total
                        ? `translate3d(calc(-100% + ${dragOffset}px), 0, 0)`
                        : undefined,
                transition: "none",
              }
            : undefined;

          return (
            <div
              key={`${slide.id}-${isAnimating ? animKey : "rest"}`}
              aria-hidden={!isActive}
              style={dragStyle}
              className={cn(
                "relative col-start-1 row-start-1 flex min-h-[400px] w-full transform-gpu flex-col justify-between gap-8 px-6 py-10 sm:min-h-[440px] sm:px-12 sm:py-14 lg:flex-row lg:items-center lg:py-16",
                isVisible
                  ? "opacity-100"
                  : "pointer-events-none invisible opacity-0",
                isActive ? "pointer-events-auto" : "pointer-events-none",
                animationClass,
              )}
            >
              {/* Left Column: Heading, description, CTA */}
              <div className="relative z-10 max-w-2xl">
                {/* Pill Badge with pulse dot */}
                <div>
                  <Badge
                    variant="outline"
                    className="border-primary/25 bg-background/80 text-primary gap-2 rounded-full px-3.5 py-1.5 text-xs font-bold shadow-xs backdrop-blur-md transition-shadow hover:shadow-sm"
                  >
                    <span className="relative flex size-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
                    </span>
                    <Sparkles className="size-3.5 text-amber-500" />
                    <span>{slide.badge}</span>
                  </Badge>
                </div>

                {/* Semantic H1 for active slide, H2 styling for inactive */}
                <div>
                  {isActive ? (
                    <h1 className="font-heading text-foreground mt-4 text-3xl leading-[1.18] font-black tracking-tight sm:text-4xl md:text-5xl lg:text-[3.25rem]">
                      {slide.title}
                    </h1>
                  ) : (
                    <div
                      role="heading"
                      aria-level={2}
                      className="font-heading text-foreground mt-4 text-3xl leading-[1.18] font-black tracking-tight sm:text-4xl md:text-5xl lg:text-[3.25rem]"
                    >
                      {slide.title}
                    </div>
                  )}
                </div>

                {/* Description */}
                <p className="text-muted-foreground mt-4 max-w-xl text-base leading-relaxed sm:text-lg">
                  {slide.description}
                </p>

                {/* Call to action buttons */}
                <div className="mt-8 flex flex-wrap items-center gap-3.5">
                  <Link
                    href={slide.ctaHref}
                    className={buttonVariants({
                      size: "lg",
                      className:
                        "group/btn btn-press hover:shadow-primary/25 gap-2.5 rounded-2xl px-6 text-base font-bold shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]",
                    })}
                  >
                    <span>{slide.ctaText}</span>
                    <ArrowRight className="size-4 transition-transform group-hover/btn:translate-x-1" />
                  </Link>

                  {slide.secondaryText && slide.secondaryHref ? (
                    <Link
                      href={slide.secondaryHref}
                      className={buttonVariants({
                        variant: "outline",
                        size: "lg",
                        className:
                          "btn-press border-border/80 bg-background/60 hover:bg-background/90 text-foreground rounded-2xl px-5 text-base font-semibold backdrop-blur-md transition-all active:scale-[0.98]",
                      })}
                    >
                      {slide.secondaryText}
                    </Link>
                  ) : null}
                </div>

                {/* Trust Perks list */}
                {slide.perks && slide.perks.length > 0 ? (
                  <div className="text-muted-foreground mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium">
                    {slide.perks.map((perk) => (
                      <span
                        key={perk}
                        className="inline-flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                        <span>{perk}</span>
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>

              {/* Right Column: Visual Showcase Card */}
              {slide.visual ? (
                <div className="lg:w-5/12">
                  <SlideVisualShowcase visual={slide.visual} />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Navigation Controls: Prev / Next with smooth spring hover */}
      <button
        type="button"
        onClick={prevSlide}
        aria-label="Slide trước đó"
        className="bg-background/75 hover:bg-background border-border/60 hover:border-primary/40 text-foreground absolute top-1/2 left-3.5 z-20 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-110 active:scale-95 sm:left-5"
      >
        <ChevronLeft className="size-5 transition-transform group-hover:-translate-x-0.5" />
      </button>

      <button
        type="button"
        onClick={nextSlide}
        aria-label="Slide tiếp theo"
        className="bg-background/75 hover:bg-background border-border/60 hover:border-primary/40 text-foreground absolute top-1/2 right-3.5 z-20 flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border shadow-lg backdrop-blur-md transition-all duration-200 hover:scale-110 active:scale-95 sm:right-5"
      >
        <ChevronRight className="size-5 transition-transform group-hover:translate-x-0.5" />
      </button>

      {/* Bottom Bar: Indicators, Autoplay Progress, Slide Counter, Play/Pause */}
      <div className="border-border/50 bg-background/75 absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border px-4 py-1.5 shadow-md backdrop-blur-md transition-colors">
        {/* Play/Pause Button */}
        <button
          type="button"
          onClick={() => setIsPaused((p) => !p)}
          aria-label={isPaused ? "Tiếp tục chạy slide" : "Tạm dừng slide"}
          className="text-muted-foreground hover:text-foreground inline-flex size-6 cursor-pointer items-center justify-center rounded-full transition-all duration-200 hover:scale-110 active:scale-90"
        >
          {isPaused ? (
            <Play className="size-3 fill-current" />
          ) : (
            <Pause className="size-3 fill-current" />
          )}
        </button>

        <div className="bg-border/60 h-3 w-px" />

        {/* Progress Pills with springy transitions */}
        <div className="flex items-center gap-1.5">
          {slides.map((slide, index) => {
            const isActive = index === currentIndex;
            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => goToSlide(index)}
                aria-label={`Chuyển tới slide ${index + 1}`}
                aria-current={isActive ? "true" : "false"}
                className={`relative h-2 cursor-pointer rounded-full transition-all duration-500 ease-out ${
                  isActive
                    ? "bg-muted w-12 overflow-hidden sm:w-16"
                    : "bg-muted-foreground/30 hover:bg-muted-foreground/60 w-3 hover:w-5"
                }`}
              >
                {isActive ? (
                  <span
                    key={`${index}-${isPaused}`}
                    className="bg-primary animate-carousel-progress absolute inset-0 rounded-full"
                    style={
                      {
                        "--carousel-duration": `${autoPlayInterval}ms`,
                        animationPlayState: isPaused ? "paused" : "running",
                      } as React.CSSProperties
                    }
                  />
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="bg-border/60 h-3 w-px" />

        {/* Slide Counter */}
        <span className="text-muted-foreground font-mono text-xs font-bold tabular-nums select-none">
          0{currentIndex + 1} / 0{total}
        </span>
      </div>
    </div>
  );
}

function SlideVisualShowcase({ visual }: { visual: HeroSlideVisual }) {
  return (
    <div className="relative hidden items-center justify-center p-4 lg:flex">
      {/* Frosted Glassmorphism Showcase Card with GPU layer */}
      <div className="bg-background/85 dark:bg-card/80 shadow-primary/10 hover:shadow-3xl relative w-full max-w-sm transform-gpu rounded-3xl border border-white/30 p-6 shadow-2xl backdrop-blur-md transition-all duration-300 will-change-transform hover:scale-[1.02] dark:border-white/10">
        {/* Header */}
        <div className="border-border/50 flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-primary/15 text-primary flex size-11 items-center justify-center rounded-2xl shadow-inner transition-transform duration-300 hover:rotate-3">
              {visual.accentIcon === "leaf" ? (
                <Leaf aria-hidden="true" className="size-5" />
              ) : visual.accentIcon === "truck" ? (
                <Truck aria-hidden="true" className="size-5" />
              ) : (
                <ShieldCheck aria-hidden="true" className="size-5" />
              )}
            </div>
            <div>
              <span className="text-primary text-[11px] font-extrabold tracking-wider uppercase">
                {visual.tag}
              </span>
              <p className="text-foreground text-xs font-bold">
                {visual.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Metric Counter Banner */}
        <div className="flex items-center justify-between py-5">
          <div>
            <p className="text-foreground text-3xl font-black tracking-tight">
              {visual.metricValue}
            </p>
            <p className="text-muted-foreground mt-0.5 text-xs font-medium">
              {visual.metricLabel}
            </p>
          </div>

          <span className="bg-accent/20 text-accent-foreground border-accent/30 inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-bold shadow-xs">
            {visual.highlightPill}
          </span>
        </div>

        {/* Real-time sync footer */}
        <div className="border-border/50 text-muted-foreground flex items-center justify-between border-t pt-3 text-xs">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="inline-block size-2 animate-ping rounded-full bg-emerald-500" />
            <span className="text-foreground text-[11px] font-semibold">
              Tồn kho thời gian thực
            </span>
          </span>
          <span className="text-primary flex items-center gap-1 text-[11px] font-bold">
            <Check aria-hidden="true" className="size-3" />
            Đã xác thực
          </span>
        </div>
      </div>
    </div>
  );
}
