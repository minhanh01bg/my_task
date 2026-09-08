import { PolicyLayout } from "@/features/online-store/policy-layout";
import { hasAdminSession } from "@/server/auth/require-admin-session";
import { getOptionalCustomerSession } from "@/server/customer-auth/session";
import { getPublicStoreProfile } from "@/server/settings/store-settings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Chính sách thanh toán",
  description: "Các phương thức thanh toán được hỗ trợ và quy trình xác nhận",
};

export default async function PaymentPolicyPage() {
  const [storeProfile, isAdmin, customerSession] = await Promise.all([
    getPublicStoreProfile(),
    hasAdminSession(),
    getOptionalCustomerSession(),
  ]);

  return (
    <PolicyLayout
      storeProfile={storeProfile}
      isAdmin={isAdmin}
      isCustomer={Boolean(customerSession)}
      title="Chính sách thanh toán"
      description="Hướng dẫn các phương thức thanh toán an toàn, minh bạch được áp dụng tại hệ thống cửa hàng."
    >
      <section className="space-y-3">
        <h2 className="text-foreground font-heading text-lg font-bold sm:text-xl">
          1. Các phương thức thanh toán hỗ trợ
        </h2>
        <div className="space-y-4 text-sm leading-relaxed">
          <div className="border-border/60 bg-muted/20 rounded-xl border p-4">
            <h3 className="text-foreground font-semibold">
              a. Thanh toán tiền mặt khi nhận hàng (COD)
            </h3>
            <p className="text-muted-foreground mt-1">
              Quý khách thanh toán trực tiếp số tiền bằng tiền mặt cho nhân viên
              giao hàng sau khi đã tiến hành đồng kiểm tình trạng kiện hàng.
            </p>
          </div>

          <div className="border-border/60 bg-muted/20 rounded-xl border p-4">
            <h3 className="text-foreground font-semibold">
              b. Chuyển khoản qua mã VietQR an toàn
            </h3>
            <p className="text-muted-foreground mt-1">
              Sau khi đặt hàng, hệ thống hiển thị mã chuẩn VietQR có sẵn số tiền
              và nội dung chuyển khoản tự động. Quý khách sử dụng bất kỳ ứng
              dụng ngân hàng di động nào để quét mã thanh toán tức thời mà không
              lo nhầm lẫn số tài khoản hay cú pháp.
            </p>
          </div>

          <div className="border-border/60 bg-muted/20 rounded-xl border p-4">
            <h3 className="text-foreground font-semibold">
              c. Thanh toán trực tiếp tại quầy
            </h3>
            <p className="text-muted-foreground mt-1">
              Áp dụng đối với đơn hàng chọn hình thức nhận tại cửa hàng (Store
              Pickup). Quý khách có thể thanh toán bằng tiền mặt hoặc chuyển
              khoản tại điểm bán.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground font-heading text-lg font-bold sm:text-xl">
          2. Xác nhận đơn hàng và hóa đơn
        </h2>
        <ul className="text-muted-foreground list-disc space-y-1.5 pl-5 text-sm leading-relaxed">
          <li>
            Mọi đơn hàng sau khi hoàn tất đều được cấp mã tra cứu đơn hàng duy
            nhất và hóa đơn điện tử/phiếu giao hàng đính kèm.
          </li>
          <li>
            Đối với giao dịch chuyển khoản VietQR, hệ thống sẽ tự động cập nhật
            trạng thái đơn hàng sau khi giao dịch ngân hàng được ghi nhận thành
            công.
          </li>
          <li>
            Nếu có bất kỳ sự cố gián đoạn nào trong quá trình chuyển khoản, nhân
            viên hỗ trợ sẽ liên hệ đối soát và xác nhận thủ công cho quý khách
            qua hotline cửa hàng.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-foreground font-heading text-lg font-bold sm:text-xl">
          3. Cam kết an toàn bảo mật thanh toán
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          Cửa hàng không lưu trữ bất kỳ thông tin tài khoản ngân hàng hoặc thẻ
          tín dụng cá nhân của quý khách. Mọi giao dịch chuyển khoản được xử lý
          trực tiếp trên giao diện ứng dụng ngân hàng của quý khách thông qua
          chuẩn VietQR của Công ty Cổ phần Thanh toán Quốc gia Việt Nam (NAPAS).
        </p>
      </section>
    </PolicyLayout>
  );
}
