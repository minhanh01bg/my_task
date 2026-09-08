import Link from "next/link";
import { Folder } from "lucide-react";

import type { OnlineCategory } from "../types";

export interface CategorySectionProps {
  categories: OnlineCategory[];
}

export function CategorySection({ categories }: CategorySectionProps) {
  return (
    <section
      id="categories"
      className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12"
    >
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-foreground text-2xl font-bold tracking-tight sm:text-3xl">
            Danh mục sản phẩm
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Khám phá theo các nhóm hàng phổ biến
          </p>
        </div>
      </div>

      {categories.length > 0 ? (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={`/shop?category=${encodeURIComponent(category.id)}#catalog`}
              className="group border-border bg-card hover:border-primary/50 hover:bg-muted/40 flex flex-col items-center justify-center rounded-2xl border p-4 text-center transition-all hover:shadow-xs"
            >
              <div className="bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground flex h-12 w-12 items-center justify-center rounded-xl transition-colors">
                <Folder className="h-6 w-6" />
              </div>
              <span className="text-foreground group-hover:text-primary mt-3 line-clamp-2 text-sm font-semibold">
                {category.name}
              </span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="border-border bg-muted/20 text-muted-foreground mt-6 rounded-2xl border border-dashed p-8 text-center text-sm">
          Đang cập nhật danh mục, mời bạn khám phá toàn bộ sản phẩm bên dưới.
        </div>
      )}
    </section>
  );
}
