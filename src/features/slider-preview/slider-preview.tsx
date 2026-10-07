import { IconArrowUpRight, IconBuildingStore } from "@tabler/icons-react";
import Link from "next/link";

import { ProductSlider } from "@/features/online-store/landing/product-slider";

import type { PreviewSlide } from "./preview-slides";
import { PREVIEW_VARIANTS } from "./preview-variants";
import type { PreviewVariant } from "./preview-variants";
import styles from "./slider-preview.module.css";

export function SliderPreview({
  variant,
  slides,
  storeName,
}: {
  variant: PreviewVariant;
  slides: PreviewSlide[];
  storeName: string;
}) {
  const settings = PREVIEW_VARIANTS.find((item) => item.id === variant)!;
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
        <ProductSlider
          variant={variant}
          slides={slides}
          storeName={storeName}
        />
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
