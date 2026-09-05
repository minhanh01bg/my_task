import { PosScreen } from "@/components/pos/pos-screen";
import { prisma } from "@/server/db/prisma";
import { getStoreBankAccount } from "@/server/settings/store-settings";
import type { CatalogResponse } from "@/types/catalog";

export const dynamic = "force-dynamic";

/**
 * Server Component nap toan bo danh muc mot lan roi truyen xuong client.
 * Tim kiem sau do chay hoan toan trong bo nho trinh duyet.
 */
export default async function PosPage() {
  const [categories, products] = await Promise.all([
    prisma.category.findMany({
      orderBy: { sortOrder: "asc" },
      select: { id: true, name: true, sortOrder: true },
    }),
    prisma.product.findMany({
      where: { isActive: true, deletedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
        price: true,
        unit: true,
        stock: true,
        imageUrl: true,
        categoryId: true,
        soldCount: true,
        searchText: true,
      },
    }),
  ]);

  const catalog: CatalogResponse = {
    categories,
    products,
    fetchedAt: new Date().toISOString(),
  };

  const bankAccount = await getStoreBankAccount();

  return <PosScreen catalog={catalog} bankAccount={bankAccount} />;
}
