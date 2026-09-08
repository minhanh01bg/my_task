import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";

import { OnlineCartProvider } from "@/features/online-store/cart-context";
import { StoreFooter } from "@/features/online-store/store-footer";
import { StoreHeader } from "@/features/online-store/store-header";
import type { PublicStoreProfile } from "@/types/storefront";

export interface PolicyLayoutProps {
  storeProfile: PublicStoreProfile;
  isAdmin?: boolean;
  isCustomer?: boolean;
  title: string;
  description: string;
  children: React.ReactNode;
}

export function PolicyLayout({
  storeProfile,
  isAdmin = false,
  isCustomer = false,
  title,
  description,
  children,
}: PolicyLayoutProps) {
  return (
    <OnlineCartProvider>
      <StoreHeader
        storeName={storeProfile.name}
        isAdmin={isAdmin}
        isCustomer={isCustomer}
      />

      <main className="mx-auto min-h-[60vh] max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        {/* Breadcrumbs */}
        <nav
          aria-label="Breadcrumb"
          className="text-muted-foreground mb-6 flex items-center gap-1.5 text-xs sm:text-sm"
        >
          <Link
            href="/shop"
            className="hover:text-foreground inline-flex items-center gap-1 transition-colors"
          >
            <ArrowLeft className="size-3.5" aria-hidden="true" />
            <span>Cửa hàng</span>
          </Link>
          <ChevronRight className="size-3.5 opacity-50" aria-hidden="true" />
          <span className="text-foreground font-medium" aria-current="page">
            {title}
          </span>
        </nav>

        {/* Header section */}
        <header className="border-border/60 mb-8 border-b pb-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            {title}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm sm:text-base">
            {description}
          </p>
          <p className="text-muted-foreground/80 mt-2 text-xs">
            Cập nhật lần cuối: Tháng 09/2026 • Áp dụng tại {storeProfile.name}
          </p>
        </header>

        {/* Content body */}
        <article className="prose prose-neutral dark:prose-invert max-w-none space-y-6">
          {children}
        </article>
      </main>

      <StoreFooter profile={storeProfile} />
    </OnlineCartProvider>
  );
}
