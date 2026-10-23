import { shopSlug } from "@/app/shop/route-params";
import {
  generateCategoryMetadata,
  renderCategoryPage,
} from "@/features/online-store/category-page";

export const revalidate = 60;

export function generateStaticParams(): Array<{ slug: string }> {
  return [];
}

interface CategoryPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: CategoryPageProps) {
  const { slug } = await params;
  return generateCategoryMetadata(shopSlug(slug), 1);
}

export default async function CategoryPage({ params }: CategoryPageProps) {
  const { slug } = await params;
  return renderCategoryPage(shopSlug(slug), 1);
}
