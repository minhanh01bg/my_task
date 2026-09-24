import { countLowStock } from "@/server/products/low-stock";

/**
 * Server Component: so san pham sap het hang canh muc "Sản phẩm" tren menu
 * admin. Doc moi lan layout render (vao trang / sau server action); khong co
 * hang sap het thi khong hien gi.
 */
export async function LowStockNavBadge() {
  const count = await countLowStock();
  if (count <= 0) return null;

  const label = `${count} sản phẩm sắp hết hàng`;
  return (
    <span
      data-slot="low-stock-badge"
      title={label}
      className="bg-warning text-warning-foreground ml-auto inline-flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] leading-5 font-bold tabular-nums"
    >
      {/* aria-label tren span khong duoc doc on dinh — dung chu sr-only. */}
      <span aria-hidden="true">{count > 99 ? "99+" : count}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
