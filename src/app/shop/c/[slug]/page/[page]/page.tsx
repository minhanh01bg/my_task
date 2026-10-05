import { notFound } from "next/navigation";

import {
  generateCategoryMetadata,
  renderCategoryPage,
} from "@/features/online-store/category-page";

export const revalidate = 60;

export function generateStaticParams(): Array<{ slug: string; page: string }> {
  return [];
}

interface CategoryPageProps {
  params: Promise<{ slug: string; page: string }>;
}

function pageNumber(value: string): number {
  const page = Number(value);
  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(page)) notFound();
  return page;
}

export async function generateMetadata({ params }: CategoryPageProps) {
  const { slug, page } = await params;
  return generateCategoryMetadata(slug, pageNumber(page));
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug, page } = await params;
  return renderCategoryPage(slug, pageNumber(page));
}
