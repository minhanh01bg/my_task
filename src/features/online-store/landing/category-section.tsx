import type { ComponentType } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Coffee,
  Cookie,
  Footprints,
  Heart,
  Home,
  Package,
  Shirt,
  ShoppingBag,
  Sparkles,
  Tag,
  Wrench,
  type LucideProps,
} from "lucide-react";

import { normalize } from "@/lib/search/normalize";
import type { OnlineCategory } from "../types";

export interface CategorySectionProps {
  categories: OnlineCategory[];
}

interface CategoryTheme {
  icon: ComponentType<LucideProps>;
  iconBg: string;
  iconColor: string;
  cardBorderHover: string;
  badgeBg: string;
}

const BASE_PALETTES: Omit<CategoryTheme, "icon">[] = [
  {
    iconBg: "bg-emerald-500/10 dark:bg-emerald-500/20",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    cardBorderHover: "hover:border-emerald-500/50 hover:shadow-emerald-500/10",
    badgeBg: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  {
    iconBg: "bg-amber-500/10 dark:bg-amber-500/20",
    iconColor: "text-amber-600 dark:text-amber-400",
    cardBorderHover: "hover:border-amber-500/50 hover:shadow-amber-500/10",
    badgeBg: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  {
    iconBg: "bg-sky-500/10 dark:bg-sky-500/20",
    iconColor: "text-sky-600 dark:text-sky-400",
    cardBorderHover: "hover:border-sky-500/50 hover:shadow-sky-500/10",
    badgeBg: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
  {
    iconBg: "bg-violet-500/10 dark:bg-violet-500/20",
    iconColor: "text-violet-600 dark:text-violet-400",
    cardBorderHover: "hover:border-violet-500/50 hover:shadow-violet-500/10",
    badgeBg: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  },
  {
    iconBg: "bg-rose-500/10 dark:bg-rose-500/20",
    iconColor: "text-rose-600 dark:text-rose-400",
    cardBorderHover: "hover:border-rose-500/50 hover:shadow-rose-500/10",
    badgeBg: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  {
    iconBg: "bg-indigo-500/10 dark:bg-indigo-500/20",
    iconColor: "text-indigo-600 dark:text-indigo-400",
    cardBorderHover: "hover:border-indigo-500/50 hover:shadow-indigo-500/10",
    badgeBg: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  },
];

function resolveCategoryTheme(name: string, index: number): CategoryTheme {
  const norm = normalize(name);

  if (/tap hoa|thuc pham|sieu thi|rau|cu|qua|thit|ca|gao|mi/.test(norm)) {
    return { ...BASE_PALETTES[0], icon: ShoppingBag };
  }
  if (/ca phe|coffee|do uong|nuoc|tra|tea|bia|ruou/.test(norm)) {
    return { ...BASE_PALETTES[1], icon: Coffee };
  }
  if (/banh|keo|snack|an vat/.test(norm)) {
    return { ...BASE_PALETTES[1], icon: Cookie };
  }
  if (/giay|dep|footwear|sneaker/.test(norm)) {
    return { ...BASE_PALETTES[2], icon: Footprints };
  }
  if (/phu tung|xe|moto|o to|sua chua|co khi|may/.test(norm)) {
    return { ...BASE_PALETTES[3], icon: Wrench };
  }
  if (/thoi trang|quan ao|shirt|ao|quan|vay|dam/.test(norm)) {
    return { ...BASE_PALETTES[4], icon: Shirt };
  }
  if (/my pham|cham soc|lam dep|spa|me|be|tre em/.test(norm)) {
    return { ...BASE_PALETTES[4], icon: Heart };
  }
  if (/gia dung|nha cua|bep|noi|dien|den/.test(norm)) {
    return { ...BASE_PALETTES[5], icon: Home };
  }

  const palette = BASE_PALETTES[index % BASE_PALETTES.length];
  const fallbackIcon = index % 2 === 0 ? Package : Tag;
  return { ...palette, icon: fallbackIcon };
}

export function CategorySection({ categories }: CategorySectionProps) {
  return (
    <section
      id="categories"
      className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="bg-primary/10 text-primary inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold">
              <Sparkles className="h-3.5 w-3.5" />
              Danh mục chọn lọc
            </span>
          </div>
          <h2 className="font-heading text-foreground mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            Danh mục sản phẩm
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Khám phá theo các nhóm hàng phổ biến và thiết yếu
          </p>
        </div>

        {categories.length > 0 ? (
          <Link
            href="#catalog"
            className="group text-primary hover:text-primary/80 inline-flex items-center gap-1 text-sm font-semibold transition-colors"
          >
            <span>Xem tất cả danh mục</span>
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        ) : null}
      </div>

      {categories.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {categories.map((category, index) => {
            const theme = resolveCategoryTheme(category.name, index);
            const IconComponent = theme.icon;

            return (
              <Link
                key={category.id}
                href={`/shop?category=${encodeURIComponent(category.id)}#catalog`}
                className={`group border-border/70 bg-card/90 hover:bg-card focus-visible:ring-primary relative flex flex-col items-center justify-between rounded-2xl border p-4 text-center transition-all duration-200 hover:-translate-y-1 hover:shadow-md focus-visible:ring-2 focus-visible:outline-none ${theme.cardBorderHover}`}
              >
                <div
                  className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110 sm:h-16 sm:w-16 ${theme.iconBg} ${theme.iconColor}`}
                >
                  <IconComponent className="h-7 w-7 transition-transform duration-300 group-hover:rotate-3 sm:h-8 sm:w-8" />
                </div>

                <div className="mt-3 flex flex-1 flex-col items-center justify-center">
                  <span className="font-heading text-foreground group-hover:text-primary line-clamp-1 text-sm font-bold transition-colors sm:text-base">
                    {category.name}
                  </span>
                  {typeof category.productCount === "number" ? (
                    <span className="text-muted-foreground mt-1 text-xs font-medium">
                      {category.productCount} sản phẩm
                    </span>
                  ) : (
                    <span className="text-muted-foreground mt-1 text-xs font-medium">
                      Khám phá ngay
                    </span>
                  )}
                </div>

                <div className="text-primary mt-2.5 flex translate-y-1 items-center gap-1 text-[11px] font-bold opacity-0 transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100">
                  <span>Xem hàng</span>
                  <ArrowRight className="h-3 w-3" />
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="border-border bg-muted/20 text-muted-foreground mt-6 rounded-2xl border border-dashed p-8 text-center text-sm">
          Đang cập nhật danh mục, mời bạn khám phá toàn bộ sản phẩm bên dưới.
        </div>
      )}
    </section>
  );
}
