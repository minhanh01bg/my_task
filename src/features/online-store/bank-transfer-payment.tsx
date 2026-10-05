import { TransferPanel } from "@/components/pos/transfer-panel";
import type { BankAccount } from "@/lib/vietqr/types";

export function BankTransferPayment({
  order,
  bankAccount,
}: {
  order: {
    code: string;
    total: number;
    status: string;
    fulfillmentStatus: string | null;
    paymentMethod?: string | null;
  };
  bankAccount: BankAccount | null;
}) {
  if (
    order.paymentMethod !== "bank_transfer" ||
    order.status !== "pending" ||
    order.fulfillmentStatus === "cancelled"
  )
    return null;

  return (
    <section
      aria-labelledby="bank-payment-title"
      className="border-border bg-card mt-6 rounded-2xl border p-4 text-left shadow-xs sm:p-6"
    >
      <h2
        id="bank-payment-title"
        className="font-heading mb-4 text-lg font-bold"
      >
        Thanh toán chuyển khoản
      </h2>
      {bankAccount ? (
        <TransferPanel
          amount={order.total}
          description={order.code}
          bankAccount={bankAccount}
        />
      ) : (
        <p className="text-muted-foreground">
          Cửa hàng chưa cung cấp tài khoản nhận tiền. Vui lòng liên hệ cửa hàng
          để được hướng dẫn thanh toán.
        </p>
      )}
      <p className="text-muted-foreground mt-4 text-sm">
        Chuyển đúng số tiền và nội dung mã đơn ở trên. Đơn chỉ xác nhận đã thanh
        toán khi cửa hàng nhận được tiền.
      </p>
    </section>
  );
}
