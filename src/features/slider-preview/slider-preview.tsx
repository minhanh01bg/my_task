"use client";

import {
  IconArrowLeft,
  IconArrowRight,
  IconArrowUpRight,
  IconPlayerPause,
  IconPlayerPlay,
  IconBuildingStore,
  IconSparkles,
} from "@tabler/icons-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { CSSProperties, PointerEvent } from "react";

import { formatVnd } from "@/lib/money";

import type { PreviewSlide } from "./preview-slides";
import { PREVIEW_VARIANTS } from "./preview-variants";
import type { PreviewVariant } from "./preview-variants";
import styles from "./slider-preview.module.css";

function subscribeReducedMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}
function reducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
const serverReducedMotion = () => false;
const ACCENTS = ["#bfe09a", "#e9c18b", "#a4d7df", "#eeb4a3", "#d4bce8"];

export function SliderPreview({
  variant,
  slides,
  storeName,
}: {
  variant: PreviewVariant;
  slides: PreviewSlide[];
  storeName: string;
}) {
  const [index, setIndex] = useState(0);
  const [autoplay, setAutoplay] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    reducedMotionSnapshot,
    serverReducedMotion,
  );
  const dragStart = useRef<number | null>(null);
  const dragged = useRef(false);
  const settings = PREVIEW_VARIANTS.find((item) => item.id === variant)!;
  const total = slides.length;
  const active = slides[index] ?? slides[0];
  const running =
    autoplay && !hovered && !focused && !reducedMotion && total > 1;
  const select = (next: number) => setIndex((next + total) % total);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(
      () => setIndex((current) => (current + 1) % total),
      6000,
    );
    return () => clearInterval(timer);
  }, [running, total]);

  function finishDrag(event: PointerEvent<HTMLDivElement>) {
    if (dragStart.current === null) return;
    const delta = event.clientX - dragStart.current;
    if (Math.abs(delta) > 45 && total > 1) {
      dragged.current = true;
      select(index + (delta < 0 ? 1 : -1));
    }
    dragStart.current = null;
  }

  return (
    <main className={styles.page}>
      <header className={styles.previewHeader}>
        <Link href="/shop" className={styles.brand}>
          <IconBuildingStore size={21} aria-hidden="true" />
          <span>{storeName}</span>
        </Link>
        <span className={styles.previewBadge}>Bản xem trước · Chờ duyệt</span>
        <Link href="/shop" className={styles.backLink}>
          Về cửa hàng <IconArrowUpRight size={16} aria-hidden="true" />
        </Link>
      </header>
      <nav aria-label="Chọn phương án slider" className={styles.variantNav}>
        {PREVIEW_VARIANTS.map((item) => (
          <Link
            key={item.id}
            href={`/shop/slider-preview/${item.id}`}
            aria-current={item.id === variant ? "page" : undefined}
            className={styles.variantLink}
          >
            <span>{item.number}</span>
            {item.name}
            <IconArrowUpRight size={15} aria-hidden="true" />
          </Link>
        ))}
      </nav>
      <section className={styles.frame}>
        <div className={styles.caption}>
          <span>PHƯƠNG ÁN {settings.number}</span>
          <p>{settings.note}</p>
        </div>
        {!active ? (
          <div className={styles.empty}>
            Chưa có sản phẩm có ảnh để xem trước.
          </div>
        ) : (
          <section
            className={`${styles.hero} ${styles[variant]}`}
            style={
              {
                "--slide-accent": ACCENTS[index % ACCENTS.length],
              } as CSSProperties
            }
            role="region"
            aria-roledescription="carousel"
            aria-label={`Slider ${settings.name}`}
            tabIndex={0}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            onFocusCapture={() => setFocused(true)}
            onBlurCapture={(event) => {
              if (
                !event.currentTarget.contains(
                  event.relatedTarget as Node | null,
                )
              )
                setFocused(false);
            }}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget || total < 2) return;
              if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                event.preventDefault();
                select(index + (event.key === "ArrowRight" ? 1 : -1));
              }
            }}
          >
            <div className={styles.heroTop}>
              <span>
                <IconSparkles size={15} aria-hidden="true" />
                {storeName}
              </span>
              <span>MUA SẮM THEO CÁCH CỦA BẠN</span>
            </div>
            <div className={styles.heroHeading}>
              <span className={styles.eyebrow}>
                NHỮNG ĐIỀU NHỎ. NIỀM VUI LỚN.
              </span>
              <h1>
                {variant === "under-the-radar" ? (
                  <>
                    Mua gì
                    <br />
                    <em>hôm nay?</em>
                  </>
                ) : variant === "spotlight" ? (
                  <>
                    Một chút tiện lợi.
                    <br />
                    <em>Thêm nhiều niềm vui.</em>
                  </>
                ) : (
                  <>
                    Điều bạn cần.
                    <br />
                    <em>Ngay ở đây.</em>
                  </>
                )}
              </h1>
              <p>
                Từ đồ dùng hằng ngày đến món bạn đang tìm — khám phá những lựa
                chọn tại cửa hàng.
              </p>
            </div>
            <div
              className={styles.stage}
              aria-label="Ảnh sản phẩm"
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                dragged.current = false;
                dragStart.current = event.clientX;
              }}
              onPointerMove={(event) => {
                if (
                  dragStart.current !== null &&
                  Math.abs(event.clientX - dragStart.current) > 8
                ) {
                  dragged.current = true;
                  event.currentTarget.setPointerCapture?.(event.pointerId);
                }
              }}
              onPointerUp={finishDrag}
              onPointerCancel={() => {
                dragStart.current = null;
              }}
              onClickCapture={(event) => {
                if (dragged.current) {
                  event.preventDefault();
                  event.stopPropagation();
                  dragged.current = false;
                }
              }}
            >
              <div className={styles.stageGlow} aria-hidden="true" />
              {slides.map((slide, slideIndex) => {
                let offset = slideIndex - index;
                if (offset > total / 2) offset -= total;
                if (offset < -total / 2) offset += total;
                const selected = slideIndex === index;
                return (
                  <button
                    type="button"
                    key={slide.id}
                    className={styles.productCard}
                    data-offset={offset}
                    aria-label={`Xem ${slide.productName}`}
                    aria-pressed={selected}
                    style={
                      {
                        "--offset": offset,
                        "--distance": Math.abs(offset),
                        "--card-accent": ACCENTS[slideIndex % ACCENTS.length],
                        zIndex: 10 - Math.abs(offset),
                      } as CSSProperties
                    }
                    onClick={() => select(slideIndex)}
                  >
                    <span className={styles.cardCategory}>
                      {slide.categoryName}
                      <IconArrowUpRight size={14} aria-hidden="true" />
                    </span>
                    <span className={styles.productImage}>
                      <Image
                        src={slide.imageUrl}
                        alt=""
                        fill
                        draggable={false}
                        className={styles.image}
                        sizes="(max-width: 640px) 190px, 280px"
                        unoptimized
                      />
                    </span>
                    <span className={styles.cardName}>{slide.productName}</span>
                    <span className={styles.cardPrice}>
                      {formatVnd(slide.price)} ₫<small>/{slide.unit}</small>
                    </span>
                  </button>
                );
              })}
              <span className={styles.dragHint}>KÉO · VUỐT · KHÁM PHÁ</span>
            </div>
            <div
              className={styles.productDetails}
              aria-live={running ? "off" : "polite"}
              aria-atomic="true"
            >
              <span className={styles.activeCategory}>
                {active.categoryName}
              </span>
              <h2>{active.productName}</h2>
              <p className={styles.activePrice}>
                {formatVnd(active.price)} ₫ <span>/{active.unit}</span>
              </p>
              <div className={styles.actions}>
                <Link
                  href={active.productHref}
                  className={styles.primaryAction}
                >
                  Mua ngay <IconArrowUpRight size={19} aria-hidden="true" />
                </Link>
                <Link
                  href={active.categoryHref}
                  className={styles.secondaryAction}
                >
                  Xem danh mục <IconArrowRight size={17} aria-hidden="true" />
                </Link>
              </div>
            </div>
            <div className={styles.controls}>
              <span className={styles.counter}>
                <strong>{String(index + 1).padStart(2, "0")}</strong>
                <span>/ {String(total).padStart(2, "0")}</span>
              </span>
              <div className={styles.dots}>
                {slides.map((slide, slideIndex) => (
                  <button
                    type="button"
                    key={slide.id}
                    aria-label={`Chọn sản phẩm ${slideIndex + 1}`}
                    aria-pressed={slideIndex === index}
                    onClick={() => select(slideIndex)}
                  />
                ))}
              </div>
              <div className={styles.controlButtons}>
                <button
                  type="button"
                  aria-label={autoplay ? "Tắt tự chạy" : "Bật tự chạy"}
                  aria-pressed={autoplay}
                  disabled={total < 2 || reducedMotion}
                  onClick={() => setAutoplay((value) => !value)}
                >
                  {autoplay ? (
                    <IconPlayerPause size={17} aria-hidden="true" />
                  ) : (
                    <IconPlayerPlay size={17} aria-hidden="true" />
                  )}
                </button>
                <button
                  type="button"
                  aria-label="Sản phẩm trước đó"
                  disabled={total < 2}
                  onClick={() => select(index - 1)}
                >
                  <IconArrowLeft size={19} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Sản phẩm tiếp theo"
                  disabled={total < 2}
                  onClick={() => select(index + 1)}
                >
                  <IconArrowRight size={19} aria-hidden="true" />
                </button>
              </div>
            </div>
          </section>
        )}
        <footer className={styles.previewFooter}>
          <p>Cùng sản phẩm · Cùng giá · Ba cách thể hiện</p>
          <a href={settings.reference} target="_blank" rel="noreferrer">
            Xem mẫu tham khảo <IconArrowUpRight size={14} aria-hidden="true" />
          </a>
        </footer>
      </section>
    </main>
  );
}
