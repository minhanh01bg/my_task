import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";

export interface HeroSectionProps {
  storeName?: string;
  tagline?: string;
  hotline?: string;
}

export function HeroSection({
  storeName = "Cửa hàng",
  tagline = "Hàng thiết yếu, đặt nhanh tại nhà",
  hotline,
}: HeroSectionProps) {
  return (
    <section className="from-primary/5 via-background to-background relative overflow-hidden bg-gradient-to-b py-16 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center">
          <Badge
            variant="outline"
            className="border-primary/20 bg-primary/10 text-primary gap-2 rounded-full px-3.5 py-1.5 text-xs font-semibold"
          >
            <ShoppingBag className="h-3.5 w-3.5" />
            <span>{storeName} • Mua sắm tiện lợi</span>
          </Badge>

          <h1 className="font-heading text-foreground mt-6 text-4xl font-extrabold tracking-tight sm:text-5xl lg:text-6xl">
            {tagline}
          </h1>

          <p className="text-muted-foreground mx-auto mt-5 max-w-xl text-lg leading-relaxed sm:text-xl">
            Giá cả minh bạch, tồn kho cập nhật theo thời gian thực. Đặt hàng dễ
            dàng giao tận nơi hoặc nhận tại cửa hàng.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="#catalog"
              className={buttonVariants({
                size: "lg",
                className: "min-h-12 gap-2 rounded-xl px-6 text-base font-bold",
              })}
            >
              <span>Mua ngay</span>
              <ArrowRight className="h-4 w-4" />
            </Link>

            {hotline ? (
              <a
                href={`tel:${hotline.replace(/\s+/g, "")}`}
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "min-h-12 rounded-xl px-5 text-base font-semibold",
                })}
              >
                Hotline: {hotline}
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}
