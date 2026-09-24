import { countLowStock } from "@/server/products/low-stock";

/**
 * Server Component: so san pham sap het hang canh muc "Sản phẩm" tren menu
 * admin. Doc moi lan layout render (vao trang / sau server action); khong co
 * hang sap het thi khong hien gi.
 */
export async function LowStockNavBadge() {
  const count = await countLowStock();
  if (count <= 0) return null;

  return (
    <span
      data-slot="low-stock-badge"
      aria-label={`${count} sản phẩm sắp hết hàng`}
      title={`${count} sản phẩm sắp hết hàng`}
      className="bg-warning text-warning-foreground ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] leading-5 font-bold tabular-nums"
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
