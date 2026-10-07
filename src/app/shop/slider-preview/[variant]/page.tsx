import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { buildPreviewSlides } from "@/features/slider-preview/preview-slides";
import {
  PREVIEW_VARIANTS,
  isPreviewVariant,
} from "@/features/slider-preview/preview-variants";
import { SliderPreview } from "@/features/slider-preview/slider-preview";
import { getOnlineCatalog } from "@/server/catalog/get-online-catalog";
import { getPublicStoreProfile } from "@/server/settings/store-settings";

export const revalidate = 60;
export const dynamicParams = false;

export function generateStaticParams() {
  return PREVIEW_VARIANTS.map(({ id }) => ({ variant: id }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ variant: string }>;
}): Promise<Metadata> {
  const { variant } = await params;
  const selected = PREVIEW_VARIANTS.find((item) => item.id === variant);
  return {
    title: `Xem trước slider ${selected?.name ?? ""}`,
    robots: { index: false, follow: false },
  };
}

export default async function SliderPreviewPage({
  params,
}: {
  params: Promise<{ variant: string }>;
}) {
  const { variant } = await params;
  if (!isPreviewVariant(variant)) notFound();
  const [catalog, profile] = await Promise.all([
    getOnlineCatalog(),
    getPublicStoreProfile(),
  ]);
  return (
    <SliderPreview
      key={variant}
      variant={variant}
      slides={buildPreviewSlides(catalog)}
      storeName={profile.name}
    />
  );
}
