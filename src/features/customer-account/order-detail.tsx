import { formatVnd } from "@/lib/money";

export function CustomerOrderDetail({
  order,
}: {
  order: {
    code: string;
    total: number;
    status: string;
    fulfillmentStatus: string | null;
    fulfillmentType: string | null;
    contactName: string | null;
    contactPhone: string | null;
    deliveryAddress: string | null;
    deliveryWard: string | null;
    deliveryDistrict: string | null;
    deliveryProvince: string | null;
    note: string | null;
    items: Array<{
      id: string;
      nameSnapshot: string;
      quantity: number;
      unit: string;
      lineTotal: number;
    }>;
  };
}) {
  const address = [
    order.deliveryAddress,
    order.deliveryWard,
    order.deliveryDistrict,
    order.deliveryProvince,
  ]
    .filter(Boolean)
    .join(", ");
  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <p className="text-primary font-bold">Đặt hàng thành công</p>
      <h1 className="mt-2 text-4xl font-bold">Đơn {order.code}</h1>
      <div className="border-border mt-8 space-y-3 rounded-2xl border p-6">
        <p>
          Trạng thái: <strong>{order.fulfillmentStatus ?? order.status}</strong>
        </p>
        <p>
          Người nhận: <strong>{order.contactName}</strong>
        </p>
        <p>
          Điện thoại: <strong>{order.contactPhone}</strong>
        </p>
        {address ? (
          <p>
            Địa chỉ: <strong>{address}</strong>
          </p>
        ) : (
          <p>Nhận tại cửa hàng</p>
        )}
      </div>
      <ul className="mt-6 divide-y">
        {order.items.map((item) => (
          <li key={item.id} className="flex justify-between py-4">
            <span>
              {item.nameSnapshot} × {item.quantity} {item.unit}
            </span>
            <strong>{formatVnd(item.lineTotal)} ₫</strong>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex justify-between text-xl font-bold">
        <span>Tổng cộng</span>
        <span>{formatVnd(order.total)} ₫</span>
      </div>
      {order.note ? <p className="mt-5">Ghi chú: {order.note}</p> : null}
    </main>
  );
}
